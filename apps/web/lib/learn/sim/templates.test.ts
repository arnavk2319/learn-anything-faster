// Template compiler skeleton. compileTemplate(input) returns {ok:true, sim} | {ok:false, errors:string[]}
// (never throws). input = {id, template, parameters?, overrides?}; overrides is a Partial<Sim> shallow-merged last.
// resolveSimRef(simOrRef, sharedSims) returns {ok:true, sim} | {ok:false, errors}; it also expands template sims.
import { describe, expect, it } from "vitest";
import { lruSim } from "../../../../../tests/fixtures/learn/sim";
import { SimSchema } from "../schemas";
import { compileTemplate, resolveSimRef, TEMPLATE_NAMES } from "./templates";

describe("TEMPLATE_NAMES registry", () => {
  it("lists the ADR templates", () => {
    for (const n of [
      "cache-aside-read",
      "cache-aside-write",
      "load-balancer",
      "leader-follower",
      "producer-consumer",
      "consistent-hash-ring",
      "sharded-lookup",
    ])
      expect(TEMPLATE_NAMES).toContain(n);
  });
  it("every registered template compiles with defaults to a schema-valid sim", () => {
    for (const template of TEMPLATE_NAMES) {
      const r = compileTemplate({ id: "t-sim", template });
      expect(r.ok, `${template}: ${r.ok ? "" : r.errors.join(";")}`).toBe(true);
      if (r.ok) {
        expect(SimSchema.safeParse(r.sim).success).toBe(true);
        expect(r.sim.id).toBe("t-sim");
        expect(r.sim.template).toBe(template);
      }
    }
  });
});

describe("compileTemplate", () => {
  it("applies parameters (capacity) and overrides", () => {
    const r = compileTemplate({
      id: "c5",
      template: "cache-aside-read",
      parameters: { capacity: 5 },
      overrides: { durationMs: 5000 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sim.durationMs).toBe(5000);
    const cache = r.sim.nodes.find((n) => n.state?.type === "lru");
    expect(cache?.state).toMatchObject({ capacity: 5 });
  });
  it("is deterministic", () => {
    const i = { id: "x", template: "load-balancer" };
    expect(compileTemplate(i)).toEqual(compileTemplate(i));
  });
  it("unknown template fails with a message naming it", () => {
    const r = compileTemplate({ id: "x", template: "no-such-template" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("no-such-template");
  });
  it("unknown parameter fails with a message naming it", () => {
    const r = compileTemplate({ id: "x", template: "cache-aside-read", parameters: { bogus: 1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("bogus");
  });
  it("wrong parameter type fails", () => {
    const r = compileTemplate({ id: "x", template: "cache-aside-read", parameters: { capacity: "big" } });
    expect(r.ok).toBe(false);
  });
  it("an override that breaks the schema fails", () => {
    const r = compileTemplate({ id: "x", template: "cache-aside-read", overrides: { durationMs: -1 } });
    expect(r.ok).toBe(false);
  });
});

describe("resolveSimRef", () => {
  it("returns an inline sim unchanged", () => {
    const r = resolveSimRef(lruSim(), []);
    expect(r).toEqual({ ok: true, sim: lruSim() });
  });
  it("resolves {ref} against shared sims", () => {
    const shared = lruSim();
    const r = resolveSimRef({ ref: shared.id }, [shared]);
    expect(r).toEqual({ ok: true, sim: shared });
  });
  it("fails on a missing ref, naming it", () => {
    const r = resolveSimRef({ ref: "ghost" }, [lruSim()]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("ghost");
  });
});
