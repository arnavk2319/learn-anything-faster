import type { Edge, TopicId } from "./types";

export interface StartCandidate {
  readonly id: TopicId;
  readonly estHours: number;
}

/**
 * The topic to begin with: not covered, every prerequisite covered or absent from the roadmap.
 * Ties: lowest topological layer (longest prerequisite chain below it), then lowest estHours,
 * then id. Returns null when nothing is startable (empty graph, or everything sits in a cycle).
 */
export function suggestStart(
  nodes: readonly StartCandidate[],
  edges: readonly Edge[],
  coveredIds: readonly TopicId[],
): TopicId | null {
  const covered = new Set(coveredIds);
  const inRoute = new Set(nodes.map((x) => x.id));

  const prereqs = new Map<TopicId, Set<TopicId>>();
  for (const { topicId, prerequisiteId } of edges) {
    const s = prereqs.get(topicId);
    if (s) s.add(prerequisiteId);
    else prereqs.set(topicId, new Set([prerequisiteId]));
  }

  // Layer = longest prerequisite chain over all edges. Memoised DFS; ids on the current stack
  // (a cycle) contribute 0 so it always terminates.
  const layers = new Map<TopicId, number>();
  const stack = new Set<TopicId>();
  const layerOf = (id: TopicId): number => {
    const known = layers.get(id);
    if (known !== undefined) return known;
    if (stack.has(id)) return 0;
    stack.add(id);
    let layer = 0;
    for (const p of prereqs.get(id) ?? []) layer = Math.max(layer, layerOf(p) + 1);
    stack.delete(id);
    layers.set(id, layer);
    return layer;
  };

  let best: { id: TopicId; layer: number; hours: number } | null = null;
  for (const { id, estHours } of nodes) {
    if (covered.has(id)) continue;
    const unmet = [...(prereqs.get(id) ?? [])].some((p) => inRoute.has(p) && !covered.has(p));
    if (unmet) continue;
    const cand = { id, layer: layerOf(id), hours: estHours };
    if (
      !best ||
      cand.layer < best.layer ||
      (cand.layer === best.layer &&
        (cand.hours < best.hours || (cand.hours === best.hours && cand.id < best.id)))
    )
      best = cand;
  }
  return best?.id ?? null;
}
