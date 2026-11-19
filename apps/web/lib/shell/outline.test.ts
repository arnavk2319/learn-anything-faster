import { describe, expect, it } from "vitest";
import type { Concept, Problem } from "../learn/schemas";
import { buildOutline, nextUp } from "./outline";

const c = (id: string, stage: Concept["stage"]) =>
  ({ id, title: id.toUpperCase(), stage }) as Concept;
const p = (id: string) => ({ id, title: id.toUpperCase() }) as Problem;

describe("outline", () => {
  const g = buildOutline(
    "t",
    [c("b", "advanced"), c("a", "basic"), c("m", "basic")],
    [p("x")],
    (id) => (id === "a" ? ["q1"] : []),
  );
  it("groups by level, drops empty levels, appends problems", () => {
    expect(g.map((x) => x.key)).toEqual(["basic", "advanced", "problems"]);
    expect(g[0]?.items.map((i) => i.id)).toEqual(["a", "m"]);
    expect(g[0]?.items[0]?.quickCheckIds).toEqual(["q1"]);
    expect(g[2]?.items[0]?.href).toBe("/learn/t/problems/x");
  });
  it("nextUp lists what follows in outline order, limited", () => {
    expect(nextUp(g, "a").map((i) => i.id)).toEqual(["m", "b", "x"]);
    expect(nextUp(g, "a", 1)).toHaveLength(1);
    expect(nextUp(g, "x")).toEqual([]);
  });
});
