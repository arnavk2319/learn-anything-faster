// Browser fetch for GET /api/roadmap. The query key is ["roadmap", from, to] (CLAUDE.md).
import { roadmapResponseSchema, type RoadmapResponse } from "./schema";

export class RoadmapFetchError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`roadmap request failed (${status})`);
    this.status = status;
  }
}

export const roadmapKey = (from: string, to: string) => ["roadmap", from, to] as const;

export async function fetchRoadmap(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<RoadmapResponse> {
  const qs = new URLSearchParams({ from, to });
  const res = await fetch(`/api/roadmap?${qs}`, { signal });
  if (!res.ok) throw new RoadmapFetchError(res.status);
  return roadmapResponseSchema.parse(await res.json());
}

/** 400 and 404 both mean "this pair is not a curated move". */
export const isUnmapped = (e: unknown) =>
  e instanceof RoadmapFetchError && (e.status === 404 || e.status === 400);
