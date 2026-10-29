// DB writes for the capture forms. Takes the db as a parameter so integration tests can pin a schema.
// Never logs input and never selects an email back out.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import { resourceSuggestions, transitionRequests } from "../../db/schema";
import { guard, type GuardContext, type RateLimiter } from "./guard";
import { resourceSuggestionSchema, transitionRequestSchema, type FormResult } from "./schemas";

// Structural: both the node-postgres and neon drivers satisfy this for inserts.
/** Wraps a pg pool or client (tests pin a schema through a client). */
export const formDbFromPg = (c: Pool | PoolClient): FormDb => drizzle(c);

export type FormDb = Pick<NodePgDatabase, "insert">;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

const FK_VIOLATION = "23503";
function isFkViolation(e: unknown): boolean {
  const c = e as { code?: string; cause?: { code?: string } };
  return c?.code === FK_VIOLATION || c?.cause?.code === FK_VIOLATION;
}

export async function submitTransitionRequest(
  db: FormDb,
  raw: unknown,
  ctx: GuardContext,
  limiter?: RateLimiter,
): Promise<FormResult> {
  const parsed = transitionRequestSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error.issues) };
  const g = await guard(ctx, limiter);
  if (g !== "ok") return { ok: false, error: "rate_limited" };
  try {
    // Duplicate (from, to, email, kind) is a no-op and looks identical to a first submit.
    await db.insert(transitionRequests).values(parsed.data).onConflictDoNothing();
    return { ok: true };
  } catch (e) {
    if (isFkViolation(e))
      return { ok: false, error: "invalid", fieldErrors: { toRole: "Pick a listed role" } };
    return { ok: false, error: "failed" };
  }
}

export async function submitResourceSuggestion(
  db: FormDb,
  raw: unknown,
  ctx: GuardContext,
  limiter?: RateLimiter,
): Promise<FormResult> {
  const parsed = resourceSuggestionSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error.issues) };
  const g = await guard(ctx, limiter);
  if (g !== "ok") return { ok: false, error: "rate_limited" };
  try {
    // Duplicate (topic, url) is a no-op and looks identical to a first submit.
    await db.insert(resourceSuggestions).values(parsed.data).onConflictDoNothing();
    return { ok: true };
  } catch (e) {
    if (isFkViolation(e))
      return { ok: false, error: "invalid", fieldErrors: { topicId: "Pick a listed topic" } };
    return { ok: false, error: "failed" };
  }
}
