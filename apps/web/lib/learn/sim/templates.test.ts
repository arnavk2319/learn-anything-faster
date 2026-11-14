// Template compiler skeleton. compileTemplate(input) returns {ok:true, sim} | {ok:false, errors:string[]}
// (never throws). input = {id, template, parameters?, overrides?}; overrides is a Partial<Sim> shallow-merged last.
// resolveSimRef(simOrRef, sharedSims) returns {ok:true, sim} | {ok:false, errors}; it also expands template sims.
import { describe, expect, it } from "vitest";
import { lruSim } from "../../../../../tests/fixtures/learn/sim";
import { SimSchema, type Sim } from "../schemas";
import { run } from "./engine";
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
    const r = compileTemplate({
      id: "x",
      template: "cache-aside-read",
      parameters: { capacity: "big" },
    });
    expect(r.ok).toBe(false);
  });
  it("an override that breaks the schema fails", () => {
    const r = compileTemplate({
      id: "x",
      template: "cache-aside-read",
      overrides: { durationMs: -1 },
    });
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

// ---- T-044 library outcomes ----
const build = (template: string, parameters?: Record<string, unknown>): Sim => {
  const r = compileTemplate({ id: "t", template, parameters });
  if (!r.ok) throw new Error(r.errors.join(";"));
  return r.sim;
};
const end = (sim: Sim, sc: string) => run({ ...sim, loop: false }, sc, sim.durationMs);

describe("template outcomes", () => {
  it("LRU: hit promotes to most recent, miss evicts the least recent", () => {
    const sim = build("cache-aside-read");
    expect(end(sim, "hit").state.cache).toMatchObject({ init: ["c", "b", "a"] });
    expect(end(sim, "miss").state.cache).toMatchObject({ init: ["d", "b", "c"] });
  });
  it("capacity override changes the output", () => {
    const miss = end(build("cache-aside-read", { capacity: 5 }), "miss");
    expect(miss.state.cache).toMatchObject({ capacity: 5, init: ["d", "b", "c", "a"] });
    expect(build("cache-aside-read", { capacity: 1 }).nodes[1]?.state).toMatchObject({
      init: ["b"],
    });
  });
  it("cache-aside-write invalidates the key", () => {
    expect(end(build("cache-aside-write"), "write").state.cache).toMatchObject({ init: {} });
  });
  it("round robin visits servers in order and evens the load", () => {
    const sim = build("load-balancer", { servers: 3 });
    const sc = sim.scenarios.find((s) => s.id === "round-robin");
    const targets = sc?.events.flatMap((ev) =>
      "send" in ev && ev.send.edge !== "e1" ? [ev.send.edge] : [],
    );
    expect(targets).toEqual(["e2", "e3", "e4", "e2", "e3", "e4"]);
    const f = end(sim, "round-robin");
    expect([f.state.s1, f.state.s2, f.state.s3].map((s) => (s as { init: number }).init)).toEqual([
      2, 2, 2,
    ]);
  });
  it("least-conn favours the lightest server", () => {
    const f = end(build("load-balancer", { servers: 3 }), "least-conn");
    expect([f.state.s1, f.state.s2, f.state.s3].map((s) => (s as { init: number }).init)).toEqual([
      2, 2, 1,
    ]);
  });
  it("leader-follower: followers catch up after replication, stale before", () => {
    const sim = build("leader-follower", { followers: 2 });
    const f = end(sim, "replicate");
    expect(f.state.leader).toMatchObject({ init: ["x"] });
    expect(f.state.f1).toMatchObject({ init: ["x"] });
    expect(f.state.f2).toMatchObject({ init: ["x"] });
    expect(run(sim, "stale-read", 1500).state.f1).toMatchObject({ init: [] });
    expect(run(sim, "stale-read", 1500).state.leader).toMatchObject({ init: ["y"] });
  });
  it("producer-consumer is FIFO", () => {
    const sim = build("producer-consumer", { jobs: 2 });
    expect(end(sim, "flow").state.queue).toMatchObject({ init: ["j2", "j3"] });
    expect(end(sim, "burst").state.queue).toMatchObject({ init: ["j2", "j3", "j4"] });
  });
  it("hash ring: adding a node moves only one key; removing moves only its keys", () => {
    const sim = build("consistent-hash-ring");
    const before = sim.nodes.find((x) => x.id === "placement")?.state as {
      init: Record<string, string>;
    };
    const added = end(sim, "add-node");
    expect(added.state.ring).toMatchObject({ init: ["n1", "n2", "n3"] });
    expect(added.state.placement).toMatchObject({ init: { ...before.init, k2: "n3" } });
    const removed = (end(sim, "remove-node").state.placement as { init: Record<string, string> })
      .init;
    expect(Object.values(removed)).not.toContain("n1");
    expect(removed.k2).toBe(before.init.k2);
  });
  it("sharded lookup routes by letter range", () => {
    const sim = build("sharded-lookup", { shards: 3 });
    expect(sim.nodes.filter((x) => x.id.startsWith("shard"))).toHaveLength(3);
    expect(sim.nodes.find((x) => x.id === "router")?.state).toMatchObject({
      init: { apple: "shard1", kiwi: "shard2", zebra: "shard3" },
    });
  });
  it("every parameter rejects out-of-range and non-integer values", () => {
    const cases: [string, string, number][] = [
      ["cache-aside-read", "capacity", 0],
      ["load-balancer", "servers", 9],
      ["load-balancer", "servers", 2.5],
      ["leader-follower", "followers", 4],
      ["producer-consumer", "jobs", 5],
      ["consistent-hash-ring", "nodes", 1],
      ["sharded-lookup", "shards", 5],
    ];
    for (const [template, k, v] of cases)
      expect(
        compileTemplate({ id: "x", template, parameters: { [k]: v } }).ok,
        `${template}.${k}=${v}`,
      ).toBe(false);
  });
});

describe("template-shaped sim refs", () => {
  it("resolveSimRef expands {id, template, parameters}", () => {
    const r = resolveSimRef(
      { id: "lb3", template: "load-balancer", parameters: { servers: 3 } },
      [],
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sim.nodes.filter((x) => x.kind === "app")).toHaveLength(3);
  });
  it("an unknown parameter in YAML shape fails", () => {
    const r = resolveSimRef({ id: "bad", template: "load-balancer", parameters: { nope: 1 } }, []);
    expect(r.ok).toBe(false);
  });
});
