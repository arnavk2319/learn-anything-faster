import { describe, expect, it } from "vitest";
import type { Question } from "./schemas";
import { displayOptions, grade, seededShuffle, toGrading, toPublic } from "./quickcheck";

const q: Question = {
  id: "q-x-1",
  conceptId: "x",
  relatedConceptIds: [],
  status: "approved",
  level: "basic",
  retired: false,
  type: "mcq",
  prompt: "Which?",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
    { id: "c", text: "C" },
  ],
  answer: ["b"],
  explanation: "Because b.",
  difficulty: 1,
  tags: [],
  src: { kind: "gap", note: "authoring choice for tests" },
};

describe("quick-check logic", () => {
  it("public shape never carries the answer, rubric or explanation", () => {
    const json = JSON.stringify(toPublic(q));
    expect(json).not.toContain("Because b");
    expect(Object.keys(toPublic(q))).not.toContain("answer");
    expect(toGrading(q).answer).toEqual(["b"]);
  });
  it("shuffle is deterministic per seed and keeps all items", () => {
    const a = seededShuffle(["a", "b", "c", "d"], "q:0");
    expect(seededShuffle(["a", "b", "c", "d"], "q:0")).toEqual(a);
    expect([...a].sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("grades by option id, not position", () => {
    expect(grade("mcq", ["b"], ["b"])).toBe(true);
    expect(grade("mcq", ["b"], ["a"])).toBe(false);
    expect(grade("multi", ["a", "c"], ["c", "a"])).toBe(true);
    expect(grade("multi", ["a", "c"], ["a"])).toBe(false);
    expect(grade("ordering", ["a", "b", "c"], ["a", "b", "c"])).toBe(true);
    expect(grade("ordering", ["a", "b", "c"], ["b", "a", "c"])).toBe(false);
  });
  it("self-graded answers return null", () => {
    expect(grade("short-explain", "model answer", [])).toBeNull();
  });
  it("ordering start order differs from the answer", () => {
    const opts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    for (let attempt = 0; attempt < 10; attempt++) {
      const shown = displayOptions({ id: "q-o", type: "ordering" }, opts, attempt, ["a", "b", "c"]);
      expect(shown.map((o) => o.id)).not.toEqual(["a", "b", "c"]);
    }
  });
});
