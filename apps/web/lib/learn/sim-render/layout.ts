// Sim layout model (ADR-0015 section 2). Pure, no DOM. ELK runs at build time only
// (generate-layouts.ts writes generated/layouts.json); the client never imports elkjs.
import type { Sim } from "../schemas";
import generated from "./generated/layouts.json";

export type Pt = { x: number; y: number };
export type NodeBox = { x: number; y: number; w: number; h: number };
export type SimLayout = {
  width: number;
  height: number;
  nodes: Record<string, NodeBox>;
  edges: Record<string, Pt[]>;
};

export const NODE_W = 208;
export const PILL_H = 40;
export const CARD_H = 96; // label row plus a 40px state widget row
export const SLOT_W = 52;
export const SLOT_GAP = 6;
export const MARGIN = 24;
const GAP_X = 88;
const GAP_Y = 28;

type SimNode = Sim["nodes"][number];

/** Size of a node. Stateful nodes are 16px-radius cards that hold their widget (DESIGN.md 14.5). */
export function nodeSize(n: SimNode): { w: number; h: number } {
  if (n.kind === "decision") return { w: 120, h: 72 };
  if (!n.state) return { w: NODE_W, h: PILL_H };
  const w =
    n.state.type === "lru" ? Math.max(NODE_W, n.state.capacity * (SLOT_W + SLOT_GAP) + 16) : NODE_W;
  return { w, h: CARD_H };
}

/** ELK input for a sim (layered, left to right, orthogonal), as the roadmap graph. */
export function elkInput(sim: Sim) {
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(GAP_Y),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(GAP_X),
      "elk.spacing.edgeNode": "16",
      "elk.padding": `[top=${MARGIN},left=${MARGIN},bottom=${MARGIN},right=${MARGIN}]`,
    },
    children: sim.nodes.map((n) => {
      const { w, h } = nodeSize(n);
      return { id: n.id, width: w, height: h };
    }),
    edges: sim.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  };
}

type ElkLaidOut = {
  width?: number;
  height?: number;
  children?: { id: string; x?: number; y?: number; width?: number; height?: number }[];
  edges?: {
    id: string;
    sections?: { startPoint: Pt; endPoint: Pt; bendPoints?: Pt[] }[];
  }[];
};

/** Turns ELK's result into the stored layout. Integer-rounded so the JSON is stable. */
export function fromElk(res: ElkLaidOut): SimLayout {
  const r = Math.round;
  const nodes: SimLayout["nodes"] = {};
  for (const c of res.children ?? [])
    nodes[c.id] = { x: r(c.x ?? 0), y: r(c.y ?? 0), w: r(c.width ?? 0), h: r(c.height ?? 0) };
  const edges: SimLayout["edges"] = {};
  for (const e of res.edges ?? []) {
    const s = e.sections?.[0];
    if (!s) continue;
    edges[e.id] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => ({
      x: r(p.x),
      y: r(p.y),
    }));
  }
  return { width: r(res.width ?? 0), height: r(res.height ?? 0), nodes, edges };
}

/** Deterministic layered layout used when no generated layout matches. Pure, no ELK. */
export function fallbackLayout(sim: Sim): SimLayout {
  const depth = new Map<string, number>();
  const ids = sim.nodes.map((n) => n.id);
  const incoming = new Set(sim.edges.map((e) => e.to));
  const queue = ids.filter((id) => !incoming.has(id));
  for (const id of queue.length ? queue : ids.slice(0, 1)) depth.set(id, 0);
  const work = [...depth.keys()];
  while (work.length) {
    const id = work.shift() as string;
    for (const e of sim.edges)
      if (e.from === id && !depth.has(e.to)) {
        depth.set(e.to, (depth.get(id) ?? 0) + 1);
        work.push(e.to);
      }
  }
  for (const id of ids) if (!depth.has(id)) depth.set(id, 0);
  const cols = new Map<number, SimNode[]>();
  for (const n of sim.nodes) {
    const d = depth.get(n.id) ?? 0;
    cols.set(d, [...(cols.get(d) ?? []), n]);
  }
  const nodes: SimLayout["nodes"] = {};
  let x = MARGIN;
  let height = 0;
  for (const d of [...cols.keys()].sort((a, b) => a - b)) {
    const col = cols.get(d) ?? [];
    const colW = Math.max(...col.map((n) => nodeSize(n).w));
    let y = MARGIN;
    for (const n of col) {
      const s = nodeSize(n);
      nodes[n.id] = { x: x + (colW - s.w) / 2, y, ...s };
      y += s.h + GAP_Y;
    }
    height = Math.max(height, y - GAP_Y + MARGIN);
    x += colW + GAP_X;
  }
  const edges: SimLayout["edges"] = {};
  for (const e of sim.edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    if (!a || !b) continue;
    const p = { x: a.x + a.w, y: a.y + a.h / 2 };
    const q = { x: b.x, y: b.y + b.h / 2 };
    if (q.x <= p.x) {
      // Backward or same-column edge: loop below both nodes.
      const low = Math.max(a.y + a.h, b.y + b.h) + 12;
      edges[e.id] = [
        { x: a.x + a.w / 2, y: a.y + a.h },
        { x: a.x + a.w / 2, y: low },
        { x: b.x + b.w / 2, y: low },
        { x: b.x + b.w / 2, y: b.y + b.h },
      ];
      height = Math.max(height, low + MARGIN);
    } else {
      const mid = (p.x + q.x) / 2;
      edges[e.id] = [p, { x: mid, y: p.y }, { x: mid, y: q.y }, q];
    }
  }
  return { width: x - GAP_X + MARGIN, height, nodes, edges };
}

const LAYOUTS = generated as unknown as Record<string, SimLayout>; // JSON import is untyped at the shape level

function covers(sim: Sim, l: SimLayout): boolean {
  return (
    sim.nodes.every((n) => {
      const b = l.nodes[n.id];
      const s = nodeSize(n);
      return b && b.w === s.w && b.h === s.h;
    }) && sim.edges.every((e) => (l.edges[e.id]?.length ?? 0) >= 2)
  );
}

/** Generated layout when it still matches the sim's nodes and edges, else the fallback. */
export function getLayout(sim: Sim): SimLayout {
  const g = Object.hasOwn(LAYOUTS, sim.id) ? LAYOUTS[sim.id] : undefined;
  return g && covers(sim, g) ? g : fallbackLayout(sim);
}

/** Point at fraction p (0..1) of the route's length. */
export function pointAlong(pts: readonly Pt[], p: number): Pt {
  const first = pts[0];
  if (!first) return { x: 0, y: 0 };
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    lens.push(l);
    total += l;
  }
  let want = Math.min(1, Math.max(0, p)) * total;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i] as number;
    if (want <= l || i === lens.length - 1) {
      const a = pts[i] as Pt;
      const b = pts[i + 1] as Pt;
      const f = l === 0 ? 0 : Math.min(1, want / l);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    want -= l;
  }
  return first;
}

/** Polyline with rounded inner corners (same geometry as the roadmap PrereqEdge). */
export function roundedPath(pts: readonly Pt[], radius = 12): string {
  const first = pts[0];
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i] as Pt;
    const prev = pts[i - 1] as Pt;
    const next = pts[i + 1];
    if (!next) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r <= 0) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const a = {
      x: cur.x - ((cur.x - prev.x) / inLen) * r,
      y: cur.y - ((cur.y - prev.y) / inLen) * r,
    };
    const b = {
      x: cur.x + ((next.x - cur.x) / outLen) * r,
      y: cur.y + ((next.y - cur.y) / outLen) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  return d;
}
