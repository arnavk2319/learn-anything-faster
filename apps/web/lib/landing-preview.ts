// Landing route-line preview data. Built only from data/seed/ (no invented topics, hours or links).
import seed from "../../../data/seed/fullstack-to-ml-engineer.json";

export type SeedShape = {
  roles: { id: string; name: string }[];
  areas: { id: string; name: string; order: number }[];
  topics: { id: string; area: string; est_hours: number | null }[];
  role_topics: { role_id: string; topic_id: string; kind: string }[];
};

export type RouteStop = { id: string; name: string; topics: number };
export type RoutePreview = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  stops: RouteStop[];
  /** Topics to learn (required by the target and not covered by the current role). */
  topicCount: number;
  knownCount: number;
  hours: number;
};

export function buildRoutePreview(data: SeedShape, fromId: string, toId: string): RoutePreview {
  const name = (id: string) => data.roles.find((r) => r.id === id)?.name ?? id;
  const covered = new Set(
    data.role_topics
      .filter((r) => r.role_id === fromId && r.kind === "covers")
      .map((r) => r.topic_id),
  );
  const required = data.role_topics
    .filter((r) => r.role_id === toId && r.kind === "requires")
    .map((r) => r.topic_id);
  const toLearn = required.filter((id) => !covered.has(id));
  const topicById = new Map(data.topics.map((t) => [t.id, t]));
  const stops = [...data.areas]
    .sort((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      name: a.name,
      topics: toLearn.filter((id) => topicById.get(id)?.area === a.id).length,
    }))
    .filter((s) => s.topics > 0);
  const hours = toLearn.reduce((sum, id) => sum + (topicById.get(id)?.est_hours ?? 0), 0);
  return {
    fromId,
    fromName: name(fromId),
    toId,
    toName: name(toId),
    stops,
    topicCount: toLearn.length,
    knownCount: required.length - toLearn.length,
    hours,
  };
}

export const SEED_FROM_ID = "full-stack-engineer";
export const SEED_TO_ID = "ml-engineer";
export const SEED_PREVIEW = buildRoutePreview(seed as SeedShape, SEED_FROM_ID, SEED_TO_ID);

export function roadmapHref(from: string, to: string): string {
  return `/roadmap/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

export type PopularMove = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  status: string;
};

/** Up to `limit` moves: the seed pair first when present, then live moves, then the rest in catalog order. */
export function pickPopular<T extends PopularMove>(entries: T[], limit = 3): T[] {
  const isSeed = (e: T) => e.from === SEED_FROM_ID && e.to === SEED_TO_ID;
  const rank = (e: T) => (isSeed(e) ? 0 : e.status === "live" ? 1 : 2);
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
