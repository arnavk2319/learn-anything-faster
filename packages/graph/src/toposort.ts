import { CycleError, findCycle } from "./cycle";
import type { Edge, TopicId } from "./types";

/** Prerequisites first; ties by id ascending. Edges touching ids outside the set are ignored. */
export function topoSort(ids: readonly TopicId[], edges: readonly Edge[]): TopicId[] {
  const set = new Set(ids);
  const inner = edges.filter((e) => set.has(e.topicId) && set.has(e.prerequisiteId));
  const cycle = findCycle(inner);
  if (cycle) throw new CycleError(cycle);

  const pending = new Map<TopicId, number>();
  const dependents = new Map<TopicId, TopicId[]>();
  const seen = new Set<string>();
  for (const id of set) pending.set(id, 0);
  for (const { topicId, prerequisiteId } of inner) {
    const key = `${topicId}\u0000${prerequisiteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pending.set(topicId, pending.get(topicId)! + 1);
    const d = dependents.get(prerequisiteId);
    if (d) d.push(topicId);
    else dependents.set(prerequisiteId, [topicId]);
  }

  // Ready list kept sorted descending so pop() yields the smallest id.
  const ready = [...set].filter((id) => pending.get(id) === 0).sort().reverse();
  const order: TopicId[] = [];
  while (ready.length > 0) {
    const id = ready.pop()!;
    order.push(id);
    for (const dep of dependents.get(id) ?? []) {
      const left = pending.get(dep)! - 1;
      pending.set(dep, left);
      if (left === 0) {
        let i = ready.length;
        while (i > 0 && ready[i - 1]! < dep) i--;
        ready.splice(i, 0, dep);
      }
    }
  }
  return order;
}
