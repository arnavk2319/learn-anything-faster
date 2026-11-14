// Pure view helpers for the sim renderer: steps, pulses, token sizing. No DOM, no React.
import type { Sim } from "../schemas";
import { run, transcript, type Frame } from "../sim/engine";

export const PULSE_MS = 600; // mirrors --sim-pulse-dur; the visual timing is CSS, this only picks the set
export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/** Times (ms) of the captioned steps of a scenario, ascending. */
export function stepTimes(sim: Sim, scenarioId: string): number[] {
  return transcript(sim, scenarioId).map((s) => s.atMs);
}

/** 0 before the first caption, else the 1-based number of the latest caption at or before t. */
export function stepIndex(times: readonly number[], t: number): number {
  let n = 0;
  for (const at of times) if (at <= t) n++;
  return n;
}

/** Time to jump to for step forward (+1) or back (-1); null when there is nowhere to go. */
export function stepTarget(times: readonly number[], t: number, dir: 1 | -1): number | null {
  const i = stepIndex(times, t);
  const next = i + dir;
  if (next < 1) return dir === -1 && i >= 1 ? 0 : null;
  if (next > times.length) return null;
  return times[next - 1] ?? null;
}

/** Nodes whose decide or state event fired within the pulse window ending at t. */
export function pulsedNodes(sim: Sim, scenarioId: string, t: number): string[] {
  const sc = sim.scenarios.find((s) => s.id === scenarioId);
  const out = new Set<string>();
  for (const ev of sc?.events ?? []) {
    if (ev.at > t || t >= ev.at + PULSE_MS) continue;
    if ("decide" in ev) out.add(ev.decide.node);
    if ("state" in ev) out.add(ev.state.node);
  }
  return [...out];
}

/** Token kinds used by a scenario, for the legend (colour defaults to request). */
export function tokenKindsUsed(sim: Sim, scenarioId: string): string[] {
  const sc = sim.scenarios.find((s) => s.id === scenarioId);
  const out = new Set<string>();
  for (const ev of sc?.events ?? []) {
    if ("send" in ev) out.add(ev.send.token.color ?? "request");
    if ("spawn" in ev) out.add(ev.spawn.token.color ?? "request");
  }
  return [...out];
}

/** Frame for display. Reduced motion shows tokens at rest mid-edge instead of in motion. */
export function frameAt(sim: Sim, scenarioId: string, t: number, reduced: boolean): Frame {
  const f = run(sim, scenarioId, t);
  if (!reduced) return f;
  return {
    ...f,
    tokens: f.tokens.map((k) => (k.progress === undefined ? k : { ...k, progress: 0.5 })),
  };
}

export function tokenWidth(label: string, color: string | undefined): number {
  return 20 + label.length * 7 + (color === "error" ? 12 : 0);
}

/** Key an upcoming `put` on a full LRU will evict, or null. Lets the widget mark the slot before it leaves. */
export function evictingKey(
  sim: Sim,
  scenarioId: string,
  t: number,
  nodeId: string,
  keys: readonly string[],
  capacity: number,
): string | null {
  if (keys.length < capacity) return null;
  const sc = sim.scenarios.find((s) => s.id === scenarioId);
  for (const ev of sc?.events ?? [])
    if (ev.at > t && "state" in ev && ev.state.node === nodeId && ev.state.op === "put")
      return keys.includes(ev.state.key ?? "") ? null : (keys[keys.length - 1] ?? null);
  return null;
}

/** Short chips for a non-LRU state widget (ring: node names, kv: k=v, counter: the number). */
export function widgetItems(state: { type: string; init: unknown }): string[] {
  const v = state.init;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "number") return [String(v)];
  if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => `${k}=${String(x)}`);
  return [];
}
