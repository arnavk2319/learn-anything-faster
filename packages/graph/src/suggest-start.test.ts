import { describe, expect, it } from "vitest";
import { suggestStart, type Edge } from "./index";

const e = (topicId: string, prerequisiteId: string): Edge => ({ topicId, prerequisiteId });
const n = (id: string, estHours = 5) => ({ id, estHours });

describe("suggestStart", () => {
  it("returns null for an empty graph", () => {
    expect(suggestStart([], [], [])).toBeNull();
  });

  it("returns the topic with no unmet prerequisites", () => {
    const nodes = [n("c"), n("b"), n("a")];
    expect(suggestStart(nodes, [e("b", "a"), e("c", "b")], [])).toBe("a");
  });

  it("counts a topic whose only prerequisites are covered as startable", () => {
    const nodes = [n("a"), n("b")];
    expect(suggestStart(nodes, [e("a", "x"), e("b", "a")], ["x"])).toBe("a");
  });

  it("treats a prerequisite absent from the roadmap as met", () => {
    expect(suggestStart([n("a")], [e("a", "ghost")], [])).toBe("a");
  });

  it("breaks ties by lowest layer, then lowest estHours, then id", () => {
    // y needs covered x (layer 1); z has no prerequisites (layer 0) but is longer.
    const edges = [e("y", "x")];
    expect(suggestStart([n("y", 1), n("z", 9)], edges, ["x"])).toBe("z");
    expect(suggestStart([n("b", 4), n("a", 6)], [], [])).toBe("b");
    expect(suggestStart([n("b", 4), n("a", 4)], [], [])).toBe("a");
  });

  it("is deterministic regardless of input order and across calls", () => {
    const nodes = [n("m", 3), n("k", 3), n("q", 3)];
    const first = suggestStart(nodes, [], []);
    expect(first).toBe("k");
    expect(suggestStart([...nodes].reverse(), [], [])).toBe(first);
    expect(suggestStart(nodes, [], [])).toBe(first);
  });

  it("terminates on a cycle", () => {
    const edges = [e("a", "b"), e("b", "a")];
    expect(suggestStart([n("a"), n("b")], edges, [])).toBeNull();
    expect(suggestStart([n("a"), n("b"), n("c")], [...edges, e("c", "x")], ["x"])).toBe("c");
  });
});
