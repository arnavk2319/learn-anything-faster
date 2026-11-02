import { describe, expect, it } from "vitest";
import { buildListModel } from "./list-model";
import type { RoadmapResponse } from "./schema";

const node = (id: string, area: string) => ({
  id,
  name: id.toUpperCase(),
  area,
  why: "w",
  estHours: 1,
  resources: [],
});
// API order is topological: alg, stats, then torch (needs stats); areas interleave.
const roadmap: RoadmapResponse = {
  from: { id: "a", name: "A" },
  to: { id: "b", name: "B" },
  nodes: [node("alg", "math"), node("stats", "math"), node("torch", "deep-learning")],
  edges: [
    { topicId: "stats", prerequisiteId: "alg" },
    { topicId: "torch", prerequisiteId: "stats" },
    { topicId: "torch", prerequisiteId: "py" },
  ],
  covered: [{ id: "py", name: "Python", area: "coding" }],
};

describe("buildListModel", () => {
  it("groups by area and keeps topological order within each area", () => {
    const m = buildListModel(roadmap, { showCovered: false });
    expect(m.map((a) => [a.key, a.label, a.topics.map((t) => t.id)])).toEqual([
      ["math", "Math", ["alg", "stats"]],
      ["deep-learning", "Deep learning", ["torch"]],
    ]);
    const steps = m.flatMap((a) => a.topics.map((t) => t.step));
    expect(steps).toEqual([1, 2, 3]);
  });

  it("lists prerequisite names, including covered ones", () => {
    const m = buildListModel(roadmap, { showCovered: false });
    expect(m[1]?.topics[0]?.needs).toEqual(["STATS", "Python"]);
    expect(m[0]?.topics[0]?.needs).toEqual([]);
  });

  it("adds a covered group first only when asked", () => {
    expect(buildListModel(roadmap, { showCovered: false })).toHaveLength(2);
    const m = buildListModel(roadmap, { showCovered: true });
    expect(m[0]).toMatchObject({ covered: true, topics: [{ id: "py", covered: true, step: 0 }] });
  });

  it("is empty for an empty roadmap", () => {
    expect(
      buildListModel({ ...roadmap, nodes: [], edges: [], covered: [] }, { showCovered: true }),
    ).toEqual([]);
  });
});
