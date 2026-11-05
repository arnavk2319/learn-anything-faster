// The single place a request passes before any form write. Order: bot check (Cloudflare Turnstile, ADR-0012),
// then the rate limiter, so a blocked bot never burns a limiter slot. Every form action calls `guard` first.
import { secretKey, TEST_SECRET_KEY } from "./turnstile-keys";

export type GuardContext = {
  ip: string;
  action: string;
  /** Turnstile token from the FormData field `cf-turnstile-response`. Never logged. */
  token?: string;
  /** Request host without port, compared with the hostname Cloudflare reports. */
  host?: string;
};

type Hit = { count: number; resetAt: number };

/** Sync for the in-memory limiter, async for the DB one (ADR-0014); `guard` awaits either. */
export type RateLimiter = (key: string, now?: number) => boolean | Promise<boolean>;

/** Fixed-window limiter, in memory. Per server instance only: kept for unit tests; production uses `createDbLimiter`. */
export function createRateLimiter(
  limit: number,
  windowMs: number,
): (key: string, now?: number) => boolean {
  const hits = new Map<string, Hit>();
  return (key, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || h.resetAt <= now) {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}

export const RATE_LIMIT = Number(process.env.FORM_RATE_LIMIT ?? 5);
export const RATE_WINDOW_MS = 10 * 60_000;

/** Per-instance fallback used only when no limiter is passed (unit tests, callers without a db). */
const defaultLimiter = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * True only when Cloudflare confirms the token. Fails closed: missing key or token, timeout, network error,
 * non-2xx, bad JSON, `success !== true`, or a hostname/action mismatch all return false. Sends only secret,
 * token and an idempotency key (no email, no form content, no remoteip). Keeps no state: tokens are single use.
 */
export async function checkBot(ctx: GuardContext): Promise<boolean> {
  const secret = secretKey();
  if (!secret || !ctx.token) return false;
  try {
    const body = new URLSearchParams({
      secret,
      response: ctx.token,
      idempotency_key: crypto.randomUUID(),
    });
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { success?: unknown; hostname?: unknown; action?: unknown };
    if (j.success !== true) return false;
    if (secret === TEST_SECRET_KEY) return true; // test tokens carry dummy hostname/action
    // Real keys: hostname and action must be present and match (a token minted on another site or form is rejected).
    return (
      typeof j.hostname === "string" &&
      !!ctx.host &&
      j.hostname === ctx.host &&
      typeof j.action === "string" &&
      j.action === ctx.action
    );
  } catch {
    return false;
  }
}

export async function guard(
  ctx: GuardContext,
  limiter: RateLimiter = defaultLimiter,
): Promise<"ok" | "blocked" | "rate_limited"> {
  if (!(await checkBot(ctx))) return "blocked";
  if (!(await limiter(`${ctx.action}:${ctx.ip}`))) return "rate_limited";
  return "ok";
}
