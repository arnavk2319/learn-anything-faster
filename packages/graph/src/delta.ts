import { prerequisiteMap } from "./cycle";
import { topoSort } from "./toposort";
import type { Edge, TopicId } from "./types";

/**
 * All transitive prerequisites of `ids` (BFS). Start ids are excluded unless reached via another
 * path. Topics in `stopAt` are neither included nor traversed. Terminates on cycles.
 */
export function transitivePrerequisites(
  ids: readonly TopicId[],
  edges: readonly Edge[],
  stopAt: ReadonlySet<TopicId> = new Set(),
): Set<TopicId> {
  const adj = prerequisiteMap(edges);
  const result = new Set<TopicId>();
  const queue = [...ids];
  for (let head = 0; head < queue.length; head++) {
    for (const p of adj.get(queue[head]!) ?? []) {
      if (stopAt.has(p) || result.has(p)) continue;
      result.add(p);
      queue.push(p);
    }
  }
  return result;
}

export interface DeltaInput {
  requires: readonly TopicId[];
  covers: readonly TopicId[];
  edges: readonly Edge[];
}

export interface Delta {
  order: TopicId[];
  edges: Edge[];
  covered: TopicId[];
}

/** delta = closure(requires) minus covers; `covered` lists the covers the target actually needs. */
export function computeDelta({ requires, covers, edges }: DeltaInput): Delta {
  const coverSet = new Set(covers);
  const starts = [...new Set(requires)].filter((id) => !coverSet.has(id));
  const included = new Set([...starts, ...transitivePrerequisites(starts, edges, coverSet)]);

  const needed = new Set(requires.filter((id) => coverSet.has(id)));
  const kept: Edge[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!included.has(e.topicId)) continue;
    if (coverSet.has(e.prerequisiteId)) needed.add(e.prerequisiteId);
    if (!included.has(e.prerequisiteId)) continue;
    const key = `${e.topicId}\u0000${e.prerequisiteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ topicId: e.topicId, prerequisiteId: e.prerequisiteId });
  }
  kept.sort((a, b) =>
    a.topicId === b.topicId
      ? a.prerequisiteId < b.prerequisiteId ? -1 : 1
      : a.topicId < b.topicId ? -1 : 1,
  );

  return { order: topoSort([...included], kept), edges: kept, covered: [...needed].sort() };
}
