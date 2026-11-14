// Pure sim engine (ADR-0015 section 2). run(spec, scenario, t) is a function of its inputs only:
// no clock, randomness, timers, DOM, React or DB. State is recomputed from init on every call,
// so scrubbing has no history dependence.
import type { Sim } from "../schemas";
import { applyStateOp, type SimState } from "./state";

export { applyStateOp } from "./state";
export type { SimState, StateOp } from "./state";

export const TOKEN_TRAVEL_MS = 800;

export type FrameToken = { label: string; color?: string; edge?: string; node?: string; progress?: number };
export type Frame = {
  t: number;
  state: Record<string, SimState>;
  decisions: Record<string, "yes" | "no">;
  highlights: { nodes: string[]; edges: string[] };
  caption: string | null;
  tokens: FrameToken[];
};
type Scenario = Sim["scenarios"][number];
type SimEvent = Scenario["events"][number];

const sortedEvents = (sc: Scenario): SimEvent[] =>
  sc.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);

const findScenario = (sim: Sim, id: string): Scenario => {
  const sc = sim.scenarios.find((s) => s.id === id);
  if (!sc) throw new Error(`unknown scenario "${id}" in sim "${sim.id}"`);
  return sc;
};

export function run(sim: Sim, scenarioId: string, tMs: number): Frame {
  const sc = findScenario(sim, scenarioId);
  const clamped = Math.max(0, tMs);
  const t = sim.loop ? clamped % sim.durationMs : Math.min(clamped, sim.durationMs);

  const state: Record<string, SimState> = {};
  for (const n of sim.nodes) if (n.state) state[n.id] = structuredClone(n.state);
  const decisions: Record<string, "yes" | "no"> = {};
  let hl = { at: -1, nodes: [] as string[], edges: [] as string[] };
  let caption: string | null = null;
  let spawned: FrameToken[] = [];
  const tokens: FrameToken[] = [];

  for (const ev of sortedEvents(sc)) {
    if (ev.at > t) break;
    if ("send" in ev) {
      if (t < ev.at + TOKEN_TRAVEL_MS)
        tokens.push({
          label: ev.send.token.label,
          ...(ev.send.token.color ? { color: ev.send.token.color } : {}),
          edge: ev.send.edge,
          progress: (t - ev.at) / TOKEN_TRAVEL_MS,
        });
    } else if ("decide" in ev) {
      decisions[ev.decide.node] = ev.decide.result;
    } else if ("state" in ev) {
      const cur = state[ev.state.node];
      if (cur) {
        const { op, key, value } = ev.state;
        state[ev.state.node] = applyStateOp(cur, { op, key, value });
      }
    } else if ("highlight" in ev) {
      if (ev.at !== hl.at) hl = { at: ev.at, nodes: [], edges: [] };
      if (ev.highlight.node) hl.nodes.push(ev.highlight.node);
      if (ev.highlight.edge) hl.edges.push(ev.highlight.edge);
    } else if ("caption" in ev) {
      caption = ev.caption;
    } else if ("spawn" in ev) {
      spawned.push({
        label: ev.spawn.token.label,
        ...(ev.spawn.token.color ? { color: ev.spawn.token.color } : {}),
        node: ev.spawn.node,
      });
    } else {
      const label = ev.remove.token;
      spawned = spawned.filter((s) => s.label !== label);
    }
  }
  return {
    t,
    state,
    decisions,
    highlights: { nodes: hl.nodes, edges: hl.edges },
    caption,
    tokens: [...tokens, ...spawned],
  };
}

export function transcript(
  sim: Sim,
  scenario: string | Scenario,
): { n: number; atMs: number; text: string }[] {
  const sc = typeof scenario === "string" ? findScenario(sim, scenario) : scenario;
  const out: { n: number; atMs: number; text: string }[] = [];
  for (const ev of sortedEvents(sc))
    if ("caption" in ev) out.push({ n: out.length + 1, atMs: ev.at, text: ev.caption });
  return out;
}
