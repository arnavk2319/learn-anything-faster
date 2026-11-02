// Pure model for the accessible list view (F10). Same RoadmapResponse as the graph, no new API.
// Areas appear in first-seen order; topics keep the API's topological order (prerequisites first).
import { areaLabel, COVERED_AREA } from "./layout";
import type { RoadmapResponse } from "./schema";

export interface ListTopic {
  id: string;
  name: string;
  covered: boolean;
  /** 1-based position in the whole route (0 for covered topics, which are not on the route). */
  step: number;
  /** Names of the prerequisites, for the "Needs" hint. */
  needs: string[];
}
export interface ListArea {
  key: string;
  label: string;
  covered: boolean;
  topics: ListTopic[];
}

export function buildListModel(
  roadmap: RoadmapResponse,
  opts: { showCovered: boolean },
): ListArea[] {
  const names = new Map<string, string>();
  for (const n of roadmap.nodes) names.set(n.id, n.name);
  for (const c of roadmap.covered) names.set(c.id, c.name);
  const needsOf = (id: string) =>
    roadmap.edges
      .filter((e) => e.topicId === id)
      .map((e) => names.get(e.prerequisiteId))
      .filter((n): n is string => Boolean(n));

  const order: string[] = [];
  const byArea = new Map<string, ListTopic[]>();
  roadmap.nodes.forEach((n, i) => {
    if (!byArea.has(n.area)) {
      byArea.set(n.area, []);
      order.push(n.area);
    }
    byArea.get(n.area)?.push({
      id: n.id,
      name: n.name,
      covered: false,
      step: i + 1,
      needs: needsOf(n.id),
    });
  });
  const areas: ListArea[] = order.map((key) => ({
    key,
    label: areaLabel(key),
    covered: false,
    topics: byArea.get(key) ?? [],
  }));
  if (opts.showCovered && roadmap.covered.length > 0) {
    areas.unshift({
      key: COVERED_AREA,
      label: "Covered by your role",
      covered: true,
      topics: roadmap.covered.map((c) => ({
        id: c.id,
        name: c.name,
        covered: true,
        step: 0,
        needs: needsOf(c.id),
      })),
    });
  }
  return areas;
}
