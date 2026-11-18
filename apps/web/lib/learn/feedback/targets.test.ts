import { describe, expect, it } from "vitest";
import type { TrackPack } from "../content";
import { targetExistsIn } from "./targets";

// Minimal hand-built pack: only the fields the check reads (cast, the full schema is not needed here).
const pack = {
  track: { id: "t1" },
  concepts: [{ id: "c1", levels: { core: [{ id: "b1" }] } }],
  problems: [{ id: "p1", blocks: [{ id: "pb" }] }],
  questions: new Map([["q1", {}]]),
  sims: [{ id: "s1" }],
} as unknown as TrackPack;

describe("targetExistsIn", () => {
  it("finds each kind and rejects unknown ids", () => {
    expect(targetExistsIn(pack, "concept", "c1")).toBe(true);
    expect(targetExistsIn(pack, "concept", "nope")).toBe(false);
    expect(targetExistsIn(pack, "problem", "p1")).toBe(true);
    expect(targetExistsIn(pack, "question", "q1")).toBe(true);
    expect(targetExistsIn(pack, "sim", "s1")).toBe(true);
    expect(targetExistsIn(pack, "track", "t1")).toBe(true);
    expect(targetExistsIn(pack, "track", "t2")).toBe(false);
  });
  it("checks block ids as <itemId>/<blockId>", () => {
    expect(targetExistsIn(pack, "block", "c1/b1")).toBe(true);
    expect(targetExistsIn(pack, "block", "p1/pb")).toBe(true);
    expect(targetExistsIn(pack, "block", "c1/zz")).toBe(false);
    expect(targetExistsIn(pack, "block", "c1")).toBe(false);
    expect(targetExistsIn(pack, "block", "c1/b1/x")).toBe(false);
  });
});
