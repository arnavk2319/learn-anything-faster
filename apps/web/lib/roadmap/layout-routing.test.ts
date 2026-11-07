import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ELK from "elkjs/lib/elk.bundled.js";
import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  AREA_TYPE,
  areaNodeId,
  buildModel,
  NODE_H,
  NODE_W,
  toElk,
  toFlow,
  type FlowGraph,
} from "./layout";
import type { RoadmapResponse } from "./schema";

interface Seed {
  topics: { id: string; name: string; area: string; why: string; est_hours: number }[];
  topic_edges: { topic_id: string; prerequisite_id: string }[];
  role_topics: { role_id: string; topic_id: string; kind: string }[];
}
const seed = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../data/seed/fullstack-to-ml-engineer.json", import.meta.url)),
    "utf8",
  ),
) as Seed;
const coveredIds = new Set(
  seed.role_topics.filter((r) => r.role_id === "full-stack-engineer").map((r) => r.topic_id),
);
const roadmap: RoadmapResponse = {
  from: { id: "full-stack-engineer", name: "Full-stack engineer" },
  to: { id: "ml-engineer", name: "ML engineer" },
  nodes: seed.topics
    .filter((t) => !coveredIds.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      area: t.area,
      why: t.why,
      estHours: t.est_hours,
      resources: [],
    })),
  edges: seed.topic_edges.map((e) => ({ topicId: e.topic_id, prerequisiteId: e.prerequisite_id })),
  covered: seed.topics
    .filter((t) => coveredIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, area: t.area })),
};

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
type Pt = { x: number; y: number };

async function layout(opts: { collapsed: string[]; showCovered: boolean }) {
  const model = buildModel(roadmap, {
    collapsed: new Set(opts.collapsed),
    showCovered: opts.showCovered,
  });
  const laid = await new ELK().layout(toElk(model));
  return { model, flow: toFlow(model, laid) };
}

/** Absolute boxes of everything an edge could hit: topic nodes and collapsed lanes (not open lanes). */
function obstacles(flow: FlowGraph): Box[] {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const open = new Set(flow.nodes.filter((n) => n.parentId).map((n) => n.parentId));
  return flow.nodes
    .filter((n) => !(n.type === AREA_TYPE && open.has(n.id)))
    .map((n: Node) => {
      const p = n.parentId ? byId.get(n.parentId) : undefined;
      return {
        id: n.id,
        x: n.position.x + (p?.position.x ?? 0),
        y: n.position.y + (p?.position.y ?? 0),
        w: n.width ?? NODE_W,
        h: n.height ?? NODE_H,
      };
    });
}

function segmentHitsBox(a: Pt, b: Pt, r: Box): boolean {
  // Routes are axis-aligned; a diagonal would be a bug, so treat it via bounding box (conservative).
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return x1 >= r.x && x0 <= r.x + r.w && y1 >= r.y && y0 <= r.y + r.h;
}

function pointsOf(e: FlowGraph["edges"][number]): Pt[] {
  return (e.data as { points?: Pt[] }).points ?? [];
}

function assertNoCrossings({ flow }: Awaited<ReturnType<typeof layout>>) {
  const boxes = obstacles(flow);
  expect(flow.edges.length).toBeGreaterThan(0);
  for (const e of flow.edges) {
    const pts = pointsOf(e);
    expect(pts.length, `edge ${e.id} has a route`).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i] as Pt, pts[i + 1] as Pt];
      expect(
        a.x === b.x || a.y === b.y,
        `edge ${e.id} segment ${i} is orthogonal ${JSON.stringify(pts)}`,
      ).toBe(true);
      for (const box of boxes) {
        if (box.id === e.source || box.id === e.target) continue;
        expect(segmentHitsBox(a, b, box), `edge ${e.id} segment ${i} crosses ${box.id}`).toBe(
          false,
        );
      }
    }
  }
}

describe("edge routing on the seed roadmap", () => {
  it("routes around every other node", async () =>
    assertNoCrossings(await layout({ collapsed: [], showCovered: false })));
  it("holds with show covered on", async () =>
    assertNoCrossings(await layout({ collapsed: [], showCovered: true })));
  it("holds with an area collapsed", async () => {
    const areas = [...new Set(roadmap.nodes.map((n) => n.area))];
    for (const a of areas) assertNoCrossings(await layout({ collapsed: [a], showCovered: true }));
  });

  it("starts at the source's right edge and ends at the target's left edge", async () => {
    const { flow } = await layout({ collapsed: [], showCovered: true });
    const byId = new Map(obstacles(flow).map((b) => [b.id, b]));
    for (const e of flow.edges) {
      const pts = pointsOf(e);
      const s = byId.get(e.source) as Box;
      const t = byId.get(e.target) as Box;
      const first = pts[0] as Pt;
      const last = pts[pts.length - 1] as Pt;
      expect(first.x, e.id).toBe(s.x + s.w);
      expect(first.y).toBeGreaterThanOrEqual(s.y);
      expect(first.y).toBeLessThanOrEqual(s.y + s.h);
      expect(last.x, e.id).toBe(t.x);
      expect(last.y).toBeGreaterThanOrEqual(t.y);
      expect(last.y).toBeLessThanOrEqual(t.y + t.h);
    }
  });
});

describe("route coordinates", () => {
  const m = buildModel(
    {
      ...roadmap,
      nodes: [
        { id: "a", name: "A", area: "x", why: "w", estHours: 1, resources: [] },
        { id: "b", name: "B", area: "y", why: "w", estHours: 1, resources: [] },
      ],
      edges: [{ topicId: "b", prerequisiteId: "a" }],
      covered: [],
    },
    { collapsed: new Set(), showCovered: false },
  );
  const edgeId = "a>b";

  it("applies the owning lane's offset to section points", () => {
    const laid = {
      id: "root",
      children: [
        {
          id: areaNodeId("x"),
          x: 100,
          y: 50,
          width: 240,
          height: 100,
          children: [{ id: "a", x: 16, y: 48 }],
        },
        {
          id: areaNodeId("y"),
          x: 400,
          y: 50,
          width: 240,
          height: 100,
          children: [{ id: "b", x: 16, y: 48 }],
        },
      ],
      edges: [
        {
          id: edgeId,
          sources: ["a"],
          targets: ["b"],
          sections: [
            {
              id: "s",
              startPoint: { x: 324, y: 118 },
              bendPoints: [{ x: 370, y: 118 }],
              endPoint: { x: 416, y: 118 },
            },
          ],
        },
      ],
    };
    expect(pointsOf(toFlow(m, laid).edges[0] as never)).toEqual([
      { x: 324, y: 118 },
      { x: 370, y: 118 },
      { x: 416, y: 118 },
    ]);
  });

  it("adds the offset of a nested lane for edges stored inside it", () => {
    const laid = {
      id: "root",
      children: [
        {
          id: areaNodeId("x"),
          x: 100,
          y: 50,
          width: 240,
          height: 100,
          children: [{ id: "a", x: 16, y: 48 }],
          edges: [
            {
              id: edgeId,
              sources: ["a"],
              targets: ["b"],
              sections: [{ id: "s", startPoint: { x: 224, y: 68 }, endPoint: { x: 300, y: 68 } }],
            },
          ],
        },
        {
          id: areaNodeId("y"),
          x: 400,
          y: 50,
          width: 240,
          height: 100,
          children: [{ id: "b", x: 16, y: 48 }],
        },
      ],
    };
    expect(pointsOf(toFlow(m, laid).edges[0] as never)).toEqual([
      { x: 324, y: 118 },
      { x: 400, y: 118 },
    ]);
  });

  it("falls back (no points, no throw) when ELK returns no sections", () => {
    const laid = {
      id: "root",
      children: [{ id: areaNodeId("x"), x: 0, y: 0, children: [{ id: "a", x: 16, y: 48 }] }],
      edges: [{ id: edgeId, sources: ["a"], targets: ["b"] }],
    };
    expect(() => toFlow(m, laid)).not.toThrow();
    expect(pointsOf(toFlow(m, laid).edges[0] as never)).toEqual([]);
  });
});

describe("layout stays off the main thread", () => {
  it("only layout.worker.ts imports elk-worker", () => {
    const dir = fileURLToPath(new URL("../..", import.meta.url));
    const files = [
      "lib/roadmap/layout.ts",
      "lib/roadmap/layout-client.ts",
      "components/roadmap/RoadmapScreen.tsx",
      "components/roadmap/RoadmapCanvas.tsx",
      "components/roadmap/PrereqEdge.tsx",
    ];
    for (const f of files)
      expect(readFileSync(`${dir}${f}`, "utf8"), f).not.toMatch(
        /^\s*import .*(elk-worker|elk\.bundled)/m,
      );
    expect(readFileSync(`${dir}lib/roadmap/layout.worker.ts`, "utf8")).toMatch(
      /^import .*elk-worker/m,
    );
  });
});
