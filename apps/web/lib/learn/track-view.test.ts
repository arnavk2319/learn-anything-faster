import { describe, expect, it } from "vitest";
import { emptyProgress, markSeen, recordAnswer, setLast } from "./progress";
import {
  continueTarget,
  conceptUnits,
  groupByLevel,
  percent,
  suggestStartConcept,
  trackCountsInWords,
} from "./track-view";

describe("groupByLevel", () => {
  it("orders levels basic to advanced, drops empty ones, keeps row order", () => {
    const rows = [
      { id: "a", stage: "advanced" as const },
      { id: "b", stage: "basic" as const },
      { id: "c", stage: "basic" as const },
    ];
    const g = groupByLevel(rows);
    expect(g.map((x) => x.level)).toEqual(["basic", "advanced"]);
    expect(g[0]?.rows.map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("conceptUnits", () => {
  const row = { id: "caching", quickCheckIds: ["q1", "q2"] };
  it("counts seen plus answered quick checks", () => {
    let p = emptyProgress();
    expect(conceptUnits(p, row)).toMatchObject({ done: 0, total: 3, complete: false });
    p = markSeen(p, "caching", 1);
    p = recordAnswer(p, "q1", true, 2);
    expect(conceptUnits(p, row)).toMatchObject({ done: 2, total: 3 });
    p = recordAnswer(p, "q2", false, 3);
    expect(conceptUnits(p, row).complete).toBe(true);
  });
  it("a concept without quick checks needs only seen", () => {
    const p = markSeen(emptyProgress(), "x", 1);
    expect(conceptUnits(p, { id: "x", quickCheckIds: [] })).toMatchObject({ done: 1, total: 1 });
  });
});

describe("continueTarget", () => {
  const concepts = [{ id: "caching", title: "Caching" }];
  const problems = [{ id: "url-shortener", title: "URL shortener" }];
  const last = (kind: "concept" | "problem" | "set", id: string, trackId = "system-design") =>
    setLast(emptyProgress(), { trackId, kind, id, at: 1 }).last;
  it("is null when empty, other track, unknown id or a set", () => {
    expect(continueTarget(undefined, "system-design", concepts, problems)).toBeNull();
    expect(
      continueTarget(last("concept", "caching", "other"), "system-design", concepts, problems),
    ).toBeNull();
    expect(continueTarget(last("concept", "gone"), "system-design", concepts, problems)).toBeNull();
    expect(continueTarget(last("set", "caching"), "system-design", concepts, problems)).toBeNull();
  });
  it("links concept and problem", () => {
    expect(
      continueTarget(last("concept", "caching"), "system-design", concepts, problems)?.href,
    ).toBe("/learn/system-design/concepts/caching");
    expect(
      continueTarget(last("problem", "url-shortener"), "system-design", concepts, problems)?.href,
    ).toBe("/learn/system-design/problems/url-shortener");
  });
});

describe("percent", () => {
  it("rounds and clamps", () => {
    expect(percent(0.376)).toBe(38);
    expect(percent(2)).toBe(100);
    expect(percent(-1)).toBe(0);
  });
});

describe("suggestStartConcept", () => {
  const c = (id: string, order: number, prerequisites: string[] = []) => ({
    id,
    order,
    prerequisites,
  });
  it("picks the lowest order concept with no prerequisites, ignoring input order", () => {
    expect(suggestStartConcept([c("b", 2), c("a", 1), c("z", 0, ["a"])])).toBe("a");
  });
  it("skips concepts with unmet prerequisites even at a lower order", () => {
    expect(suggestStartConcept([c("x", 1, ["y"]), c("y", 5)])).toBe("y");
  });
  it("treats done and out-of-track prerequisites as met", () => {
    expect(suggestStartConcept([c("x", 1, ["y"]), c("y", 5)], new Set(["y"]))).toBe("x");
    expect(suggestStartConcept([c("x", 1, ["gone"]), c("y", 5)])).toBe("x");
  });
  it("falls back to the lowest order on a cycle; null when empty", () => {
    expect(suggestStartConcept([c("a", 2, ["b"]), c("b", 1, ["a"])])).toBe("b");
    expect(suggestStartConcept([])).toBeNull();
  });
});

describe("trackCountsInWords", () => {
  it("writes counts as words with correct plurals", () => {
    expect(trackCountsInWords(6, 2)).toBe("6 concepts, 2 problems");
    expect(trackCountsInWords(1, 1)).toBe("1 concept, 1 problem");
    expect(trackCountsInWords(0, 0)).toBe("0 concepts, 0 problems");
  });
});
