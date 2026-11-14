// Contract for the pure sim engine (T-040, ADR-0015 section 2).
// Expected modules (implementer): ./engine (run, transcript, applyStateOp, TOKEN_TRAVEL_MS),
// ./templates (TEMPLATE_NAMES, compileTemplate, resolveSimRef). See the ticket Tests section.
import { describe, expect, it } from "vitest";
import { lruSim } from "../../../../../tests/fixtures/learn/sim";
import { SimSchema } from "../schemas";
import { run, transcript, TOKEN_TRAVEL_MS } from "./engine";

const sim = lruSim();
const lruItems = (f: ReturnType<typeof run>, id = "cache") =>
  (f.state[id] as { init: string[] }).init;

describe("run: purity", () => {
  it("1000 repeated calls give deep-equal frames and do not mutate the spec", () => {
    const before = JSON.stringify(sim);
    const first = run(sim, "miss-evict", 2500);
    for (let i = 0; i < 1000; i++) expect(run(sim, "miss-evict", 2500)).toEqual(first);
    expect(JSON.stringify(sim)).toBe(before);
  });

  it("frame 0 shows init state and no caption", () => {
    const f = run(sim, "hit", 0);
    expect(lruItems(f)).toEqual(["b", "c", "a"]);
    expect(f.caption).toBeNull();
  });

  it("throws on an unknown scenario id", () => {
    expect(() => run(sim, "nope", 0)).toThrow();
  });
});

describe("run: events", () => {
  it("state ops apply at event time (inclusive), not before", () => {
    expect(lruItems(run(sim, "hit", 799))).toEqual(["b", "c", "a"]);
    expect(lruItems(run(sim, "hit", 800))).toEqual(["c", "b", "a"]);
    expect(run(sim, "hit", 800).state.hits).toMatchObject({ type: "counter", init: 1 });
  });

  it("put on a full cache evicts the least recent", () => {
    expect(lruItems(run(sim, "miss-evict", 2200))).toEqual(["d", "b", "c"]);
  });

  it("decide records the latest result per node", () => {
    expect(run(sim, "hit", 800).decisions.hit).toBe("yes");
    expect(run(sim, "miss-evict", 800).decisions.hit).toBe("no");
    expect(run(sim, "hit", 100).decisions.hit).toBeUndefined();
  });

  it("caption is the latest caption at or before t, in time order not array order", () => {
    const f = (t: number) => run(sim, "miss-evict", t).caption;
    expect(f(999)).toBeNull();
    expect(f(1000)).toBe("Miss: go to the database");
    expect(f(2200)).toBe("a evicted (least recent)");
  });

  it("highlight is reported", () => {
    expect(run(sim, "hit", 800).highlights.nodes).toContain("cache");
    expect(run(sim, "hit", 0).highlights.nodes).not.toContain("cache");
  });

  it("send makes a token travel an edge for TOKEN_TRAVEL_MS with linear progress", () => {
    const mid = run(sim, "hit", TOKEN_TRAVEL_MS / 2);
    const tok = mid.tokens.find((t) => t.label === "GET c");
    expect(tok).toMatchObject({ edge: "e1", color: "request" });
    expect(tok?.progress).toBeCloseTo(0.5);
    expect(run(sim, "hit", TOKEN_TRAVEL_MS + 1).tokens.some((t) => t.label === "GET c")).toBe(false);
  });

  it("spawn adds a token on a node until a remove event names its label", () => {
    expect(run(sim, "miss-evict", 3500).tokens.some((t) => t.label === "d value")).toBe(true);
    expect(run(sim, "miss-evict", 4000).tokens.some((t) => t.label === "d value")).toBe(false);
  });
});

describe("run: time handling", () => {
  it("loop wraps t modulo durationMs", () => {
    expect(run(sim, "hit", 9000 + 800)).toEqual(run(sim, "hit", 800));
  });
  it("non-loop clamps to durationMs and negative t to 0", () => {
    const s = { ...lruSim(), loop: false };
    expect(run(s, "hit", 99999)).toEqual(run(s, "hit", 9000));
    expect(run(s, "hit", -5)).toEqual(run(s, "hit", 0));
  });
});

describe("run: scrubbing has no history dependence", () => {
  const times = [0, 1, 799, 800, 900, 1600, 2200, 3000, 4000, 8999];
  for (const sc of sim.scenarios) {
    it(`scenario ${sc.id}: run at a then b equals run at b`, () => {
      for (const a of times) {
        for (const b of times) {
          run(sim, sc.id, a);
          expect(run(sim, sc.id, b)).toEqual(run(lruSim(), sc.id, b));
        }
      }
    });
  }
});

describe("transcript", () => {
  it("golden: numbered, caption-ordered, no DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(transcript(sim, "hit")).toEqual([{ n: 1, atMs: 1600, text: "c is moved to most-recent; DB untouched" }]);
    expect(transcript(sim, "miss-evict")).toEqual([
      { n: 1, atMs: 1000, text: "Miss: go to the database" },
      { n: 2, atMs: 2200, text: "a evicted (least recent)" },
    ]);
  });
  it("accepts the scenario object or id and throws on unknown id", () => {
    expect(transcript(sim, sim.scenarios[0]!.id)).toEqual(transcript(sim, "hit"));
    expect(() => transcript(sim, "nope")).toThrow();
  });
  it("fixture is a valid Sim", () => {
    expect(SimSchema.safeParse(sim).success).toBe(true);
  });
});
