// Request -> Response handlers, separated from the route files so tests can call them directly.
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { roadmapQuerySchema, type ApiError, type HealthResponse } from "./schema";
import { getRoadmap, type RoadmapDb } from "./service";

/** Per-pair edge cache: the URL (from, to) is the cache key. Content changes ship as deploys, which purge it. */
export const ROADMAP_CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600";
const NOT_FOUND_CACHE = "public, max-age=0, s-maxage=60";
const NO_STORE = "no-store";

const json = (body: ApiError | HealthResponse | object, status: number, cache: string) =>
  Response.json(body, { status, headers: { "Cache-Control": cache } });

export async function handleRoadmap(req: Request, db: () => Promise<RoadmapDb>): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const parsed = roadmapQuerySchema.safeParse({ from: sp.get("from"), to: sp.get("to") });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? "query")] ??= i.message;
    return json({ error: "invalid_params", fields } satisfies ApiError, 400, NO_STORE);
  }
  try {
    const roadmap = await getRoadmap(await db(), parsed.data.from, parsed.data.to);
    if (!roadmap) return json({ error: "not_found" } satisfies ApiError, 404, NOT_FOUND_CACHE);
    return json(roadmap, 200, ROADMAP_CACHE);
  } catch {
    return json({ error: "unavailable" } satisfies ApiError, 503, NO_STORE);
  }
}

export type HealthDb = Pick<NodePgDatabase, "execute">;

export async function handleHealth(db: () => Promise<HealthDb>): Promise<Response> {
  try {
    await (await db()).execute(sql`select 1`);
    return json({ status: "ok", db: "ok" } satisfies HealthResponse, 200, NO_STORE);
  } catch {
    return json({ status: "error", db: "error" } satisfies HealthResponse, 503, NO_STORE);
  }
}
