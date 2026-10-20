import type { Edge, TopicId } from "./types";

export class CycleError extends Error {
  readonly cycle: TopicId[];
  constructor(cycle: TopicId[]) {
    super(`Cycle detected: ${[...cycle, cycle[0]].join(" -> ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

/** Adjacency map topic -> prerequisites, sorted ascending and deduped. */
export function prerequisiteMap(edges: readonly Edge[]): Map<TopicId, TopicId[]> {
  const m = new Map<TopicId, Set<TopicId>>();
  for (const { topicId, prerequisiteId } of edges) {
    let s = m.get(topicId);
    if (!s) m.set(topicId, (s = new Set()));
    s.add(prerequisiteId);
  }
  const out = new Map<TopicId, TopicId[]>();
  for (const [k, s] of m) out.set(k, [...s].sort());
  return out;
}

/** Returns the ids of one cycle (in edge order) or null. Iterative DFS, deterministic. */
export function findCycle(edges: readonly Edge[]): TopicId[] | null {
  const adj = prerequisiteMap(edges);
  const state = new Map<TopicId, 1 | 2>(); // 1 = on stack, 2 = done
  for (const root of [...adj.keys()].sort()) {
    if (state.has(root)) continue;
    const path: TopicId[] = [root];
    const iters: number[] = [0];
    state.set(root, 1);
    while (path.length > 0) {
      const node = path[path.length - 1]!;
      const next = adj.get(node) ?? [];
      const i = iters[iters.length - 1]!;
      if (i >= next.length) {
        state.set(node, 2);
        path.pop();
        iters.pop();
        continue;
      }
      iters[iters.length - 1] = i + 1;
      const n = next[i]!;
      const s = state.get(n);
      if (s === 1) return path.slice(path.indexOf(n));
      if (s === undefined) {
        state.set(n, 1);
        path.push(n);
        iters.push(0);
      }
    }
  }
  return null;
}
