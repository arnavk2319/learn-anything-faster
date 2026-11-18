// POST /api/learn/feedback logic (ADR-0017). Deps are injected so integration tests pin a schema and a limiter.
// Order: origin, Zod, existence, limiter, write. Never logs or reports the body, client id, note, IP or target ids.
import { sql, type SQL } from "drizzle-orm";
import {
  feedbackRequestSchema,
  hashClientId,
  normalizeNote,
  type FeedbackTargetKind,
} from "./schemas";

export type FeedbackDb = { execute: (q: SQL) => PromiseLike<unknown> };

export type FeedbackDeps = {
  db: () => Promise<FeedbackDb>;
  /** Resolves true when allowed. Fails open itself (createDbLimiter). */
  limiter: (key: string) => boolean | Promise<boolean>;
  targetExists: (trackId: string, kind: FeedbackTargetKind, id: string) => boolean;
  clientIp: (h: Headers) => string;
  /** Error class name and stage only. */
  report: (stage: "parse" | "limit" | "write", errorClass: string) => void;
  random?: () => number;
  windowMs: number;
};

export const FEEDBACK_LIMIT = 30;
export const FEEDBACK_WINDOW_MS = 600_000;
const MAX_BODY_BYTES = 2048;
const PRUNE_ONE_IN = 50;

const json = (status: number, body: Record<string, unknown>, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

const invalid = () => json(400, { error: "invalid" });

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host
  )
    .split(",")[0]!
    .trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const errorClass = (e: unknown): string => (e instanceof Error ? e.name : "UnknownError");
const isMissingTable = (e: unknown): boolean => {
  const c = e as { code?: string; cause?: { code?: string } };
  return c?.code === "42P01" || c?.cause?.code === "42P01";
};

export async function handleFeedback(req: Request, deps: FeedbackDeps): Promise<Response> {
  if (!sameOrigin(req)) return json(403, { error: "forbidden" });

  let raw: unknown;
  try {
    if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
      return invalid();
    const text = await req.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return invalid();
    raw = JSON.parse(text);
  } catch (e) {
    deps.report("parse", errorClass(e));
    return invalid();
  }
  const parsed = feedbackRequestSchema.safeParse(raw);
  if (!parsed.success) return invalid();
  const r = parsed.data;

  if (!deps.targetExists(r.trackId, r.targetKind, r.targetId)) return invalid();

  if (!(await deps.limiter(`learn-feedback:${deps.clientIp(req.headers)}`))) {
    const retry = Math.max(1, Math.ceil((deps.windowMs - (Date.now() % deps.windowMs)) / 1000));
    return json(429, { error: "rate_limited" }, { "retry-after": String(retry) });
  }

  const hash = hashClientId(r.clientId);
  try {
    const db = await deps.db();
    if (r.rating === null) {
      await db.execute(sql`
        DELETE FROM learn_feedback
        WHERE track_id = ${r.trackId} AND target_kind = ${r.targetKind}
          AND target_id = ${r.targetId} AND client_hash = ${hash}`);
    } else {
      const note = normalizeNote(r.note, r.rating);
      await db.execute(sql`
        INSERT INTO learn_feedback (track_id, target_kind, target_id, client_hash, rating, note)
        VALUES (${r.trackId}, ${r.targetKind}, ${r.targetId}, ${hash}, ${r.rating}, ${note})
        ON CONFLICT (track_id, target_kind, target_id, client_hash)
        DO UPDATE SET rating = EXCLUDED.rating, note = EXCLUDED.note, updated_at = now()`);
    }
    if ((deps.random ?? Math.random)() < 1 / PRUNE_ONE_IN) {
      try {
        await db.execute(sql`
          UPDATE learn_feedback SET note = NULL WHERE ctid IN (
            SELECT ctid FROM learn_feedback
            WHERE note IS NOT NULL AND updated_at < now() - interval '180 days' LIMIT 100)`);
      } catch {
        // best effort
      }
    }
    return json(200, { ok: true });
  } catch (e) {
    if (!isMissingTable(e)) deps.report("write", errorClass(e));
    return json(503, { error: "unavailable" });
  }
}
