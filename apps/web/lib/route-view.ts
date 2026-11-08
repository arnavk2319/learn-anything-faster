// Landing route preview view-model. Live data comes only from the GET /api/roadmap response.
import { areaLabel } from "./roadmap/layout";
import type { RoadmapResponse } from "./roadmap/schema";
import type { RoutePreview } from "./landing-preview";

export type RouteView =
  { kind: "abstract" } | { kind: "unmapped" } | { kind: "live"; preview: RoutePreview };

/** Null when the response has no nodes (nothing to show, so the caller falls back to abstract). */
export function previewFromRoadmap(r: RoadmapResponse): RoutePreview | null {
  if (r.nodes.length === 0) return null;
  const byArea = new Map<string, number>();
  for (const n of r.nodes) byArea.set(n.area, (byArea.get(n.area) ?? 0) + 1);
  return {
    fromId: r.from.id,
    fromName: r.from.name,
    toId: r.to.id,
    toName: r.to.name,
    stops: [...byArea].map(([id, topics]) => ({ id, name: areaLabel(id), topics })),
    topicCount: r.nodes.length,
    knownCount: r.covered.length,
    hours: r.nodes.reduce((sum, n) => sum + n.estHours, 0),
  };
}

export type RouteViewInput = {
  chosen: boolean;
  same: boolean;
  isCurated: boolean;
  /** Response for the current pair only (the query key guarantees it is never another pair's). */
  data?: RoadmapResponse;
  unmappedError?: boolean;
};

export function deriveRouteView(i: RouteViewInput): RouteView {
  if (!i.chosen || i.same) return { kind: "abstract" };
  if (!i.isCurated || i.unmappedError) return { kind: "unmapped" };
  const preview = i.data ? previewFromRoadmap(i.data) : null;
  return preview ? { kind: "live", preview } : { kind: "abstract" };
}
