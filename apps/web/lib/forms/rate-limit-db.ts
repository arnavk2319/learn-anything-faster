// Shared rate limiter on the existing Postgres (ADR-0014). One atomic upsert per call; fixed windows on the DB clock.
// Errors go to the injected `onError` (wired to Sentry in rate-limit-report.ts) so this module, which the root
// tsc pulls in through the integration tests, does not import Sentry's DOM-heavy types. Keys are hex sha256 of "<action>:<ip>", so no raw IP is stored. Fails open on store errors (Turnstile already
// fails closed); the error is reported to Sentry with a tag only, never the key or IP.
import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { RateLimiter } from "./guard";
import { rateLimitSchema } from "./schemas";

/** Structural so both the node-postgres and neon drivers fit: both return `{ rows }` from `execute`. */
export type LimiterDb = { execute: (q: SQL) => PromiseLike<unknown> };

const PRUNE_ONE_IN = 50;
const PRUNE_BATCH = 100;

const rowsOf = (res: unknown): unknown[] => {
  const r = res as { rows?: unknown[] } | unknown[] | null;
  return Array.isArray(r) ? r : (r?.rows ?? []);
};

export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export function createDbLimiter(
  db: LimiterDb,
  limit: number,
  windowMs: number,
  opts: { random?: () => number; onError?: (e: unknown) => void } = {},
): RateLimiter {
  const random = opts.random ?? Math.random;
  const interval = `${Math.max(1, Math.round(windowMs / 1000))} seconds`;
  return async (key) => {
    try {
      const res = await db.execute(sql`
        INSERT INTO rate_limits (key, window_start, count)
        VALUES (${hashKey(key)}, date_bin(${interval}::interval, now(), 'epoch'), 1)
        ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
        RETURNING key, window_start AS "windowStart", count`);
      const row = rateLimitSchema.parse(rowsOf(res)[0]);
      if (random() < 1 / PRUNE_ONE_IN) {
        // Bounded, best effort; errors are swallowed.
        void Promise.resolve(
          db.execute(sql`
            DELETE FROM rate_limits WHERE ctid IN (
              SELECT ctid FROM rate_limits WHERE window_start < now() - interval '1 hour' LIMIT ${PRUNE_BATCH})`),
        ).then(
          () => undefined,
          () => undefined,
        );
      }
      return row.count <= limit;
    } catch (e) {
      try {
        opts.onError?.(e);
      } catch {
        // reporting must never break a submit
      }
      return true;
    }
  };
}
