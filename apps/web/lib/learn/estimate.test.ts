import { describe, expect, it } from "vitest";
import { makePack } from "../../../../tests/fixtures/learn/pack";
import { formatEstimate } from "./estimate";
import { ConceptSchema, ProblemSchema } from "./schemas";

describe("formatEstimate", () => {
  it.each([
    [1, "Under 1 hour"],
    [59, "Under 1 hour"],
    [60, "About 1 hour"],
    [89, "About 1 hour"],
    [90, "About 2 hours"],
    [120, "About 2 hours"],
    [600, "About 10 hours"],
    [1500, "About 25 hours"],
  ])("%i min -> %s", (m, out) => expect(formatEstimate(m)).toBe(out));
  it("never uses pace wording", () => {
    for (const m of [1, 60, 300, 600])
      expect(formatEstimate(m)).not.toMatch(/week|day|per|finish/i);
  });
});

describe("estMin schema", () => {
  const c = (estMin: unknown) => ({ ...makePack().concepts[0], estMin });
  const pr = (estMin: unknown) => ({ ...makePack().problems[0], estMin });
  it("accepts 1 and 600 on concept and problem", () => {
    for (const v of [1, 25, 600]) {
      expect(ConceptSchema.safeParse(c(v)).success).toBe(true);
      expect(ProblemSchema.safeParse(pr(v)).success).toBe(true);
    }
  });
  it("rejects 0, 601, 1.5, '30', null", () => {
    for (const v of [0, 601, 1.5, "30", null]) {
      expect(ConceptSchema.safeParse(c(v)).success, String(v)).toBe(false);
      expect(ProblemSchema.safeParse(pr(v)).success, String(v)).toBe(false);
    }
  });
  it("packs without estMin still validate", () => {
    const pack = makePack();
    expect(ConceptSchema.safeParse(pack.concepts[0]).success).toBe(true);
    expect(ProblemSchema.safeParse(pack.problems[0]).success).toBe(true);
  });
});
