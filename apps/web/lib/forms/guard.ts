// The single place a request passes before any form write. Fast lane (ADR-0008): no Turnstile.
// To add a bot check later, implement it in `checkBot` (read its token from the FormData/headers) and
// nothing else changes: every form action calls `guard` first.

export type GuardContext = { ip: string; action: string };

type Hit = { count: number; resetAt: number };

export type RateLimiter = (key: string, now?: number) => boolean;

/** Fixed-window limiter, in memory. Per server instance only (see T-014 findings for the gap). */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
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

const defaultLimiter = createRateLimiter(Number(process.env.FORM_RATE_LIMIT ?? 5), 10 * 60_000);

/** Placeholder seam: returns true when the caller passes the bot check. Always true in the fast lane. */
export async function checkBot(ctx: GuardContext): Promise<boolean> {
  void ctx;
  return true;
}

export async function guard(
  ctx: GuardContext,
  limiter: RateLimiter = defaultLimiter,
): Promise<"ok" | "blocked" | "rate_limited"> {
  if (!(await checkBot(ctx))) return "blocked";
  if (!limiter(`${ctx.action}:${ctx.ip}`)) return "rate_limited";
  return "ok";
}
