// Pure layout preparation for the roadmap graph (no React, no DOM). The API sends no positions:
// this builds the model (areas, visible topics, edges re-routed around collapsed areas), the ELK
// input graph, and turns ELK's result into React Flow nodes and edges.
import type { ElkEdge, ElkNode } from "elkjs/lib/elk-api";
import type { Edge, Node } from "@xyflow/react";
import type { RoadmapResponse } from "./schema";

export const NODE_W = 208;
export const NODE_H = 40;
export const LANE_HEADER = 48; // DESIGN.md section 12: 48px top padding
export const LANE_PAD = 16;
export const COVERED_AREA = "__covered";
export const TOPIC_TYPE = "topic";
export const AREA_TYPE = "area";

export const areaNodeId = (area: string) => `area:${area}`;

/** "classical-ml" -> "Classical ml". Display only; the id never changes. */
export const areaLabel = (area: string) => {
  const s = area.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface TopicModel {
  id: string;
  name: string;
  covered: boolean;
  /** Names the area of the topic for accessible labels. */
  area: string;
}
export interface AreaModel {
  /** Raw area key from the API, or COVERED_AREA for the synthetic lane. */
  key: string;
  label: string;
  covered: boolean;
  collapsed: boolean;
  /** Always the full topic list, so a collapsed lane can still show a count. */
  topics: TopicModel[];
}
export interface EdgeModel {
  id: string;
  source: string; // React Flow node id (topic id, or area node id when its area is collapsed)
  target: string;
  /** Underlying topic edges, used to highlight the selected topic's edges. */
  pairs: { topicId: string; prerequisiteId: string }[];
}
export interface GraphModel {
  areas: AreaModel[];
  edges: EdgeModel[];
}

export interface ModelOptions {
  collapsed: ReadonlySet<string>;
  showCovered: boolean;
}

export function buildModel(roadmap: RoadmapResponse, opts: ModelOptions): GraphModel {
  const areaOrder: string[] = [];
  const byArea = new Map<string, TopicModel[]>();
  for (const n of roadmap.nodes) {
    if (!byArea.has(n.area)) {
      byArea.set(n.area, []);
      areaOrder.push(n.area);
    }
    byArea.get(n.area)?.push({ id: n.id, name: n.name, covered: false, area: n.area });
  }
  const areas: AreaModel[] = areaOrder.map((key) => ({
    key,
    label: areaLabel(key),
    covered: false,
    collapsed: opts.collapsed.has(key),
    topics: byArea.get(key) ?? [],
  }));
  if (opts.showCovered && roadmap.covered.length > 0) {
    areas.unshift({
      key: COVERED_AREA,
      label: "Covered by your role",
      covered: true,
      collapsed: opts.collapsed.has(COVERED_AREA),
      topics: roadmap.covered.map((c) => ({ id: c.id, name: c.name, covered: true, area: c.area })),
    });
  }

  // Where each topic lives on the canvas: itself, or its lane when the lane is collapsed.
  const endpoint = new Map<string, string>();
  for (const a of areas)
    for (const t of a.topics) endpoint.set(t.id, a.collapsed ? areaNodeId(a.key) : t.id);

  const merged = new Map<string, EdgeModel>();
  for (const e of roadmap.edges) {
    const source = endpoint.get(e.prerequisiteId);
    const target = endpoint.get(e.topicId);
    if (!source || !target || source === target) continue; // hidden or inside one collapsed lane
    const id = `${source}>${target}`;
    const pair = { topicId: e.topicId, prerequisiteId: e.prerequisiteId };
    const existing = merged.get(id);
    if (existing) existing.pairs.push(pair);
    else merged.set(id, { id, source, target, pairs: [pair] });
  }
  return { areas, edges: [...merged.values()] };
}

const ROOT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "12",
  "elk.layered.spacing.nodeNodeBetweenLayers": "52",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  // Orthogonal routes avoid node boxes; the spacings keep the channels between layers wide enough.
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.edgeNodeBetweenLayers": "16",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "10",
  "elk.spacing.edgeNode": "16",
  "elk.spacing.edgeEdge": "10",
  "elk.padding": "[top=16,left=16,bottom=16,right=16]",
};

/** ELK input: areas are compound nodes holding their topics; a collapsed area is a leaf. */
export function toElk(model: GraphModel): ElkNode {
  return {
    id: "root",
    layoutOptions: ROOT_OPTIONS,
    children: model.areas.map((a): ElkNode => {
      const id = areaNodeId(a.key);
      if (a.collapsed) return { id, width: NODE_W + 2 * LANE_PAD, height: LANE_HEADER };
      return {
        id,
        layoutOptions: {
          "elk.padding": `[top=${LANE_HEADER},left=${LANE_PAD},bottom=${LANE_PAD},right=${LANE_PAD}]`,
        },
        children: a.topics.map((t) => ({ id: t.id, width: NODE_W, height: NODE_H })),
      };
    }),
    edges: model.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
}

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/** ELK's floats carry noise (306.6666 vs 306.66666): snap so straight segments stay exactly straight. */
const snap = (n: number) => Math.round(n * 100) / 100;

/** The part of ELK's edge section we read (elk-api types it only on extended edges). */
interface ElkSection {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: { x: number; y: number }[];
}

export interface RoutePoint {
  x: number;
  y: number;
}

/**
 * Absolute flow-coordinate route per edge id, from ELK sections. Coordinates are relative to the
 * node that holds the edge (the root, or a lane), so that node's absolute offset is added.
 */
export function absoluteRoutes(laid: ElkNode): Map<string, RoutePoint[]> {
  const abs = new Map<string, RoutePoint>();
  const walk = (n: ElkNode, ox: number, oy: number) => {
    const o = { x: ox + (n.x ?? 0), y: oy + (n.y ?? 0) };
    abs.set(n.id, o);
    for (const c of n.children ?? []) walk(c, o.x, o.y);
  };
  abs.set(laid.id, { x: 0, y: 0 });
  for (const c of laid.children ?? []) walk(c, 0, 0);

  const routes = new Map<string, RoutePoint[]>();
  const collect = (n: ElkNode) => {
    const holder = abs.get(n.id) ?? { x: 0, y: 0 };
    for (const e of n.edges ?? []) {
      const { sections, container } = e as ElkEdge & {
        sections?: ElkSection[];
        container?: string;
      };
      const sec = sections?.[0];
      if (!sec) continue;
      const off = (container !== undefined ? abs.get(container) : undefined) ?? holder;
      routes.set(
        e.id,
        [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint].map((p) => ({
          x: snap(p.x + off.x),
          y: snap(p.y + off.y),
        })),
      );
    }
    for (const c of n.children ?? []) collect(c);
  };
  collect(laid);
  return routes;
}

/** React Flow wants parents before children and positions relative to the parent: ELK gives both. */
export function toFlow(model: GraphModel, laid: ElkNode): FlowGraph {
  const pos = new Map((laid.children ?? []).map((n) => [n.id, n]));
  const nodes: Node[] = [];
  for (const a of model.areas) {
    const id = areaNodeId(a.key);
    const l = pos.get(id);
    const width = l?.width ?? NODE_W + 2 * LANE_PAD;
    const height = l?.height ?? LANE_HEADER;
    nodes.push({
      id,
      type: AREA_TYPE,
      position: { x: l?.x ?? 0, y: l?.y ?? 0 },
      width,
      height,
      data: {
        areaKey: a.key,
        label: a.label,
        covered: a.covered,
        collapsed: a.collapsed,
        count: a.topics.length,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
    });
    if (a.collapsed) continue;
    const kids = new Map((l?.children ?? []).map((n) => [n.id, n]));
    for (const t of a.topics) {
      const k = kids.get(t.id);
      nodes.push({
        id: t.id,
        type: TOPIC_TYPE,
        parentId: id,
        position: { x: k?.x ?? LANE_PAD, y: k?.y ?? LANE_HEADER },
        width: NODE_W,
        height: NODE_H,
        data: { name: t.name, covered: t.covered, area: t.area },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: 1,
      });
    }
  }
  const routes = absoluteRoutes(laid);
  const edges: Edge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "prereq",
    // No route (ELK gave no sections): PrereqEdge falls back to a bezier.
    data: { pairs: e.pairs, points: routes.get(e.id) ?? [] },
    focusable: false,
    selectable: false,
    zIndex: 2,
  }));
  return { nodes, edges };
}

/** Does this edge touch the selected topic? Used to highlight (DESIGN.md section 8). */
export function edgeTouches(
  pairs: readonly { topicId: string; prerequisiteId: string }[],
  selectedId: string | null,
): boolean {
  return (
    selectedId !== null &&
    pairs.some((p) => p.topicId === selectedId || p.prerequisiteId === selectedId)
  );
}
