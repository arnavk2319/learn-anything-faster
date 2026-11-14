// Node state ops: applyStateOp(state, {op, key?, value?}) returns a NEW state of the same shape
// ({type, ...}, with `init` holding the current contents). Unknown op for a type throws.
import { describe, expect, it } from "vitest";
import { applyStateOp } from "./engine";

const lru = (init: string[], capacity = 3) => ({ type: "lru" as const, capacity, init });

describe("lru", () => {
  it("touch moves an existing key to the front", () => {
    expect(applyStateOp(lru(["b", "c", "a"]), { op: "touch", key: "a" }).init).toEqual(["a", "b", "c"]);
  });
  it("touch of a missing key is a no-op", () => {
    expect(applyStateOp(lru(["b", "c", "a"]), { op: "touch", key: "z" }).init).toEqual(["b", "c", "a"]);
  });
  it("put adds at the front without eviction below capacity", () => {
    expect(applyStateOp(lru(["b"]), { op: "put", key: "d" }).init).toEqual(["d", "b"]);
  });
  it("put on a full cache evicts the last (least recent)", () => {
    expect(applyStateOp(lru(["b", "c", "a"]), { op: "put", key: "d" }).init).toEqual(["d", "b", "c"]);
  });
  it("put of an existing key moves it to front without eviction", () => {
    expect(applyStateOp(lru(["b", "c", "a"]), { op: "put", key: "a" }).init).toEqual(["a", "b", "c"]);
  });
  it("does not mutate its input", () => {
    const s = lru(["b", "c", "a"]);
    applyStateOp(s, { op: "put", key: "d" });
    expect(s.init).toEqual(["b", "c", "a"]);
  });
});

describe("queue", () => {
  const q = { type: "queue" as const, init: ["j1", "j2"] };
  it("push appends, pop removes the head", () => {
    expect(applyStateOp(q, { op: "push", key: "j3" }).init).toEqual(["j1", "j2", "j3"]);
    expect(applyStateOp(q, { op: "pop" }).init).toEqual(["j2"]);
  });
  it("pop on empty is a no-op", () => {
    expect(applyStateOp({ type: "queue", init: [] }, { op: "pop" }).init).toEqual([]);
  });
});

describe("kv", () => {
  const kv = { type: "kv" as const, init: { a: "1" } };
  it("set adds or overwrites, delete removes", () => {
    expect(applyStateOp(kv, { op: "set", key: "b", value: "2" }).init).toEqual({ a: "1", b: "2" });
    expect(applyStateOp(kv, { op: "set", key: "a", value: "9" }).init).toEqual({ a: "9" });
    expect(applyStateOp(kv, { op: "delete", key: "a" }).init).toEqual({});
  });
});

describe("counter", () => {
  const c = { type: "counter" as const, init: 5 };
  it("inc/dec default to 1 and accept a numeric value string", () => {
    expect(applyStateOp(c, { op: "inc" }).init).toBe(6);
    expect(applyStateOp(c, { op: "dec" }).init).toBe(4);
    expect(applyStateOp(c, { op: "inc", value: "10" }).init).toBe(15);
  });
});

describe("ring", () => {
  const r = { type: "ring" as const, init: ["n1", "n2"] };
  it("add appends a node, remove drops it", () => {
    expect(applyStateOp(r, { op: "add", key: "n3" }).init).toEqual(["n1", "n2", "n3"]);
    expect(applyStateOp(r, { op: "remove", key: "n1" }).init).toEqual(["n2"]);
  });
  it("add of an existing node is a no-op", () => {
    expect(applyStateOp(r, { op: "add", key: "n1" }).init).toEqual(["n1", "n2"]);
  });
});

describe("invalid ops", () => {
  it("unknown op for the state type throws", () => {
    expect(() => applyStateOp({ type: "counter", init: 0 }, { op: "touch", key: "a" })).toThrow();
  });
});
