import { describe, expect, it } from "vitest";
import {
  areaLabel,
  areaNodeId,
  buildModel,
  COVERED_AREA,
  edgeTouches,
  toElk,
  toFlow,
} from "./layout";
import type { RoadmapResponse } from "./schema";

const node = (id: string, area: string) => ({
  id,
  name: id.toUpperCase(),
  area,
  why: "w",
  estHours: 1,
  resources: [],
});
const roadmap: RoadmapResponse = {
  from: { id: "a", name: "A" },
  to: { id: "b", name: "B" },
  nodes: [node("alg", "math"), node("stats", "math"), node("torch", "deep-learning")],
  edges: [
    { topicId: "stats", prerequisiteId: "alg" },
    { topicId: "torch", prerequisiteId: "alg" },
    { topicId: "torch", prerequisiteId: "stats" },
  ],
  covered: [{ id: "py", name: "Python", area: "coding" }],
};
const none = new Set<string>();

describe("buildModel", () => {
  it("groups by area in topological order and keeps all edges when expanded", () => {
    const m = buildModel(roadmap, { collapsed: none, showCovered: false });
    expect(m.areas.map((a) => a.key)).toEqual(["math", "deep-learning"]);
    expect(m.edges).toHaveLength(3);
  });

  it("re-routes edges to a collapsed lane, merges duplicates and drops internal ones", () => {
    const m = buildModel(roadmap, { collapsed: new Set(["math"]), showCovered: false });
    expect(m.edges.map((e) => e.id)).toEqual([`${areaNodeId("math")}>torch`]);
    expect(m.edges[0]?.pairs).toHaveLength(2);
  });

  it("adds the covered lane first only when asked", () => {
    const m = buildModel(roadmap, { collapsed: none, showCovered: true });
    expect(m.areas[0]).toMatchObject({ key: COVERED_AREA, covered: true });
    expect(m.areas[0]?.topics.map((t) => t.id)).toEqual(["py"]);
  });
});

describe("toElk / toFlow", () => {
  it("nests topics in area compound nodes; a collapsed area is a leaf", () => {
    const m = buildModel(roadmap, { collapsed: new Set(["math"]), showCovered: false });
    const elk = toElk(m);
    expect(elk.children?.[0]?.children).toBeUndefined();
    expect(elk.children?.[1]?.children?.map((c) => c.id)).toEqual(["torch"]);
    expect(elk.edges).toHaveLength(1);
  });

  it("emits parents before children with relative positions", () => {
    const m = buildModel(roadmap, { collapsed: none, showCovered: false });
    const laid = {
      id: "root",
      children: [
        {
          id: areaNodeId("math"),
          x: 5,
          y: 6,
          width: 240,
          height: 140,
          children: [
            { id: "alg", x: 16, y: 48 },
            { id: "stats", x: 16, y: 100 },
          ],
        },
        {
          id: areaNodeId("deep-learning"),
          x: 300,
          y: 6,
          width: 240,
          height: 88,
          children: [{ id: "torch", x: 16, y: 48 }],
        },
      ],
    };
    const { nodes, edges } = toFlow(m, laid);
    expect(nodes.map((n) => n.id)).toEqual([
      areaNodeId("math"),
      "alg",
      "stats",
      areaNodeId("deep-learning"),
      "torch",
    ]);
    expect(nodes.find((n) => n.id === "stats")).toMatchObject({
      parentId: areaNodeId("math"),
      position: { x: 16, y: 100 },
    });
    expect(edges).toHaveLength(3);
  });
});

describe("helpers", () => {
  it("labels areas for display", () => expect(areaLabel("classical-ml")).toBe("Classical ml"));
  it("highlights only edges touching the selection", () => {
    const pairs = [{ topicId: "b", prerequisiteId: "a" }];
    expect(edgeTouches(pairs, "a")).toBe(true);
    expect(edgeTouches(pairs, "c")).toBe(false);
    expect(edgeTouches(pairs, null)).toBe(false);
  });
});
