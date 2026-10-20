import { describe, expect, it } from "vitest";
import {
  CycleError,
  computeDelta,
  findCycle,
  topoSort,
  transitivePrerequisites,
  type Edge,
} from "./index";

// e(a, b): topic a requires prerequisite b.
const e = (topicId: string, prerequisiteId: string): Edge => ({ topicId, prerequisiteId });
const pos = (order: string[], id: string) => order.indexOf(id);

describe("findCycle", () => {
  it("returns null for no edges and for a DAG", () => {
    expect(findCycle([])).toBeNull();
    expect(findCycle([e("b", "a"), e("c", "b"), e("c", "a")])).toBeNull();
  });
  it("finds A->B->A", () => {
    const c = findCycle([e("A", "B"), e("B", "A")]);
    expect(c).not.toBeNull();
    expect([...(c as string[])].sort()).toEqual(["A", "B"]);
  });
  it("finds a self-loop", () => {
    const c = findCycle([e("A", "A")]);
    expect(c).not.toBeNull();
    expect(c).toContain("A");
  });
});

describe("topoSort", () => {
  it("empty input", () => {
    expect(topoSort([], [])).toEqual([]);
  });
  it("puts prerequisites first, ties by id ascending", () => {
    expect(topoSort(["c", "b", "a"], [])).toEqual(["a", "b", "c"]);
    expect(topoSort(["a", "b", "c"], [e("a", "c")])).toEqual(["b", "c", "a"]);
  });
  it("diamond", () => {
    const order = topoSort(["d", "c", "b", "a"], [e("b", "a"), e("c", "a"), e("d", "b"), e("d", "c")]);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });
  it("ignores edges with endpoints outside ids", () => {
    expect(topoSort(["a", "b"], [e("a", "x"), e("y", "b"), e("z", "x")])).toEqual(["a", "b"]);
  });
  it("throws CycleError with cycle ids", () => {
    try {
      topoSort(["A", "B"], [e("A", "B"), e("B", "A")]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CycleError);
      expect([...(err as CycleError).cycle].sort()).toEqual(["A", "B"]);
    }
  });
  it("self-loop throws CycleError", () => {
    expect(() => topoSort(["A"], [e("A", "A")])).toThrow(CycleError);
  });
  it("does not mutate inputs", () => {
    const ids = ["c", "a", "b"];
    const edges = [e("c", "a")];
    const ci = [...ids];
    const ce = structuredClone(edges);
    topoSort(ids, edges);
    expect(ids).toEqual(ci);
    expect(edges).toEqual(ce);
  });
});

describe("transitivePrerequisites", () => {
  const chain = [e("d", "c"), e("c", "b"), e("b", "a")];
  it("empty inputs", () => {
    expect(transitivePrerequisites([], [])).toEqual(new Set());
  });
  it("walks a deep chain, excluding the start ids", () => {
    expect(transitivePrerequisites(["d"], chain)).toEqual(new Set(["a", "b", "c"]));
  });
  it("includes a start id only if reached via another path", () => {
    expect(transitivePrerequisites(["c", "d"], chain)).toEqual(new Set(["a", "b", "c"]));
  });
  it("diamond yields each prerequisite once", () => {
    const edges = [e("d", "b"), e("d", "c"), e("b", "a"), e("c", "a")];
    expect(transitivePrerequisites(["d"], edges)).toEqual(new Set(["a", "b", "c"]));
  });
  it("does not traverse into stopAt topics", () => {
    const r = transitivePrerequisites(["d"], chain, new Set(["b"]));
    expect(r.has("c")).toBe(true);
    expect(r.has("a")).toBe(false);
  });
  it("terminates on cycles or throws CycleError, never hangs", () => {
    try {
      transitivePrerequisites(["A"], [e("A", "B"), e("B", "A")]);
    } catch (err) {
      expect(err).toBeInstanceOf(CycleError);
    }
  });
});

describe("computeDelta", () => {
  it("empty inputs", () => {
    expect(computeDelta({ requires: [], covers: [], edges: [] })).toEqual({
      order: [],
      edges: [],
      covered: [],
    });
  });
  it("requires fully covered gives empty delta", () => {
    const r = computeDelta({ requires: ["a", "b"], covers: ["a", "b", "z"], edges: [e("b", "a")] });
    expect(r.order).toEqual([]);
    expect(r.edges).toEqual([]);
    expect(r.covered).toEqual(["a", "b"]);
  });
  it("diamond dependency", () => {
    const edges = [e("d", "b"), e("d", "c"), e("b", "a"), e("c", "a")];
    const r = computeDelta({ requires: ["d"], covers: [], edges });
    expect(r.order).toEqual(["a", "b", "c", "d"]);
    expect(r.edges).toHaveLength(4);
    expect(r.covered).toEqual([]);
  });
  it("pulls in prerequisites not listed in requires (deep chain)", () => {
    const edges = [e("d", "c"), e("c", "b"), e("b", "a")];
    const r = computeDelta({ requires: ["d"], covers: [], edges });
    expect(r.order).toEqual(["a", "b", "c", "d"]);
  });
  it("covered prerequisite stops traversal and is reported covered", () => {
    const edges = [e("d", "c"), e("c", "b"), e("b", "a")];
    const r = computeDelta({ requires: ["d"], covers: ["b"], edges });
    expect(r.order).toEqual(["c", "d"]);
    expect(r.edges).toEqual([e("d", "c")]);
    expect(r.covered).toEqual(["b"]);
  });
  it("covered topic's own prerequisites are not pulled in and not covered", () => {
    const edges = [e("c", "b"), e("b", "a")];
    const r = computeDelta({ requires: ["c"], covers: ["b"], edges });
    expect(r.order).toEqual(["c"]);
    expect(r.order).not.toContain("a");
    expect(r.covered).toEqual(["b"]);
  });
  it("covers the target does not need are not reported", () => {
    const r = computeDelta({ requires: ["a"], covers: ["x", "y"], edges: [] });
    expect(r.covered).toEqual([]);
    expect(r.order).toEqual(["a"]);
  });
  it("covered is sorted", () => {
    const r = computeDelta({ requires: ["z", "m"], covers: ["z", "m"], edges: [] });
    expect(r.covered).toEqual(["m", "z"]);
  });
  it("edges outside the included set are ignored", () => {
    const edges = [e("a", "x"), e("q", "r"), e("b", "a")];
    const r = computeDelta({ requires: ["a", "b"], covers: [], edges: edges.filter((x) => x.topicId !== "a") });
    expect(r.edges).toEqual([e("b", "a")]);
    const r2 = computeDelta({ requires: ["a", "b"], covers: ["x"], edges });
    expect(r2.edges).toEqual([e("b", "a")]);
    expect(r2.order).toEqual(["a", "b"]);
  });
  it("throws CycleError with cycle ids", () => {
    try {
      computeDelta({ requires: ["A"], covers: [], edges: [e("A", "B"), e("B", "A")] });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CycleError);
      expect([...(err as CycleError).cycle].sort()).toEqual(["A", "B"]);
    }
  });
  it("self-loop throws CycleError", () => {
    expect(() => computeDelta({ requires: ["A"], covers: [], edges: [e("A", "A")] })).toThrow(CycleError);
  });
  it("cycle among covered-only topics does not throw", () => {
    const r = computeDelta({ requires: ["c"], covers: ["A", "B", "c"], edges: [e("A", "B"), e("B", "A")] });
    expect(r.order).toEqual([]);
  });
  it("tolerates duplicates in input", () => {
    const edges = [e("b", "a"), e("b", "a")];
    const r = computeDelta({ requires: ["b", "b"], covers: ["z", "z"], edges });
    expect(r.order).toEqual(["a", "b"]);
    expect(new Set(r.order).size).toBe(r.order.length);
    expect(r.edges).toEqual([e("b", "a")]);
  });
  it("is deterministic under shuffled input", () => {
    const edges = [e("d", "b"), e("d", "c"), e("b", "a"), e("c", "a"), e("f", "e")];
    const base = computeDelta({ requires: ["d", "f", "g"], covers: ["a"], edges });
    for (let i = 0; i < 20; i++) {
      const shuffle = <T>(xs: T[]) =>
        xs.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
      const r = computeDelta({
        requires: shuffle(["d", "f", "g"]),
        covers: shuffle(["a"]),
        edges: shuffle(edges),
      });
      expect(r.order).toEqual(base.order);
      expect(r.covered).toEqual(base.covered);
      expect(r.edges.map((x) => x.topicId + x.prerequisiteId).sort()).toEqual(
        base.edges.map((x) => x.topicId + x.prerequisiteId).sort(),
      );
    }
    expect(pos(base.order, "b")).toBeLessThan(pos(base.order, "d"));
  });
  it("does not mutate inputs", () => {
    const input = { requires: ["d", "c"], covers: ["a"], edges: [e("d", "c"), e("c", "a")] };
    const copy = structuredClone(input);
    computeDelta(input);
    expect(input).toEqual(copy);
  });
  it("few hundred topics in under 100 ms", () => {
    const n = 500;
    const ids = Array.from({ length: n }, (_, i) => `t${String(i).padStart(4, "0")}`);
    const edges: Edge[] = [];
    for (let i = 1; i < n; i++) {
      edges.push(e(ids[i]!, ids[i - 1]!));
      if (i > 5) edges.push(e(ids[i]!, ids[i - 5]!));
    }
    const t0 = performance.now();
    const r = computeDelta({ requires: [ids[n - 1]!], covers: [ids[10]!], edges });
    expect(performance.now() - t0).toBeLessThan(100);
    expect(r.order.length).toBeGreaterThan(400);
  });
});
