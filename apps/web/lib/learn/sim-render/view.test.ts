import { describe, expect, it } from "vitest";
import { compileTemplate } from "../sim/templates";
import { fallbackLayout, getLayout, pointAlong, roundedPath } from "./layout";
import {
  evictingKey,
  widgetItems,
  frameAt,
  pulsedNodes,
  stepIndex,
  stepTarget,
  stepTimes,
  tokenKindsUsed,
} from "./view";

const r = compileTemplate({ id: "cache-aside-read", template: "cache-aside-read" });
if (!r.ok) throw new Error("fixture");
const sim = r.sim;

describe("steps", () => {
  const times = stepTimes(sim, "miss");
  it("lists captioned times and indexes them", () => {
    expect(times).toEqual([1800]);
    expect(stepIndex(times, 0)).toBe(0);
    expect(stepIndex(times, 1800)).toBe(1);
  });
  it("steps forward and back, null at the ends", () => {
    expect(stepTarget(times, 0, 1)).toBe(1800);
    expect(stepTarget(times, 1800, 1)).toBeNull();
    expect(stepTarget(times, 1800, -1)).toBe(0);
    expect(stepTarget(times, 0, -1)).toBeNull();
  });
});

describe("frame helpers", () => {
  it("pulses nodes with a state event inside the window only", () => {
    expect(pulsedNodes(sim, "miss", 1900)).toEqual(["cache"]);
    expect(pulsedNodes(sim, "miss", 2500)).toEqual([]);
  });
  it("legend kinds come from the scenario", () => {
    expect(tokenKindsUsed(sim, "miss")).toEqual(["request"]);
  });
  it("reduced motion shows tokens at rest mid-edge", () => {
    expect(frameAt(sim, "miss", 100, false).tokens[0]?.progress).toBeCloseTo(100 / 800);
    expect(frameAt(sim, "miss", 100, true).tokens[0]?.progress).toBe(0.5);
  });
});

describe("widgets", () => {
  it("marks the eviction victim only before a put of a new key on a full LRU", () => {
    expect(evictingKey(sim, "miss", 0, "cache", ["b", "c", "a"], 3)).toBe("a");
    expect(evictingKey(sim, "miss", 1900, "cache", ["d", "b", "c"], 3)).toBeNull();
    expect(evictingKey(sim, "miss", 0, "cache", ["b"], 3)).toBeNull();
  });
  it("turns state into chips", () => {
    expect(widgetItems({ type: "kv", init: { k: "v" } })).toEqual(["k=v"]);
    expect(widgetItems({ type: "counter", init: 3 })).toEqual(["3"]);
    expect(widgetItems({ type: "ring", init: ["a", "b"] })).toEqual(["a", "b"]);
  });
});

describe("layout geometry", () => {
  it("generated layout is used for template sims and fallback covers the rest", () => {
    const l = getLayout(sim);
    expect(l.nodes.cache?.h).toBe(96);
    const fb = fallbackLayout(sim);
    expect(Object.keys(fb.nodes).sort()).toEqual(["app", "cache", "db"]);
    expect(fb.edges.e1?.length).toBeGreaterThanOrEqual(2);
  });
  it("interpolates along a route and rounds corners", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(pointAlong(pts, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(pts, 1)).toEqual({ x: 10, y: 10 });
    expect(roundedPath(pts, 4)).toContain("Q 10 0");
  });
});
