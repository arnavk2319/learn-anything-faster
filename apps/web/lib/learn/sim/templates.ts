// Sim template library (ADR-0015 section 2): template + parameters + overrides -> full Sim.
// Pure; compileTemplate never throws. TEMPLATE_NAMES is the registry the content validator consumes.
// Every template declares its allowed parameters (name, integer range, default) in `params`; unknown
// parameters, wrong types and out-of-range values fail compilation. State types are fixed per template.
import { SimSchema, type Sim, type TemplateSim } from "../schemas";

type Node = Sim["nodes"][number];
type Edge = Sim["edges"][number];
type Scenario = Sim["scenarios"][number];
type Ev = Scenario["events"][number];
type Base = { nodes: Node[]; edges: Edge[]; scenarios: Scenario[] };
type ParamSpec = { min: number; max: number; default: number };
type Params = Record<string, number>;
type Template = { params: Record<string, ParamSpec>; build: (p: Params) => Base };

const n = (
  id: string,
  kind: Node["kind"],
  label: string,
  inspect: string,
  state?: Node["state"],
): Node => (state ? { id, kind, label, inspect, state } : { id, kind, label, inspect });
const e = (id: string, from: string, to: string, label?: string): Edge =>
  label ? { id, from, to, label } : { id, from, to };
const send = (
  at: number,
  edge: string,
  label: string,
  color: "request" | "response" | "replicate" = "request",
): Ev => ({
  at,
  send: { edge, token: { label, color } },
});
const st = (at: number, node: string, op: string, key?: string, value?: string): Ev => ({
  at,
  state: {
    node,
    op,
    ...(key !== undefined ? { key } : {}),
    ...(value !== undefined ? { value } : {}),
  },
});
const cap = (at: number, caption: string): Ev => ({ at, caption });
const range = (count: number, prefix: string, from = 1): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + from}`);

const TEMPLATES: Record<string, Template> = {
  /**
   * cache-aside-read. Parameters: capacity (int 1-6, default 3, LRU size).
   * State: cache = lru (most-recent-first, last key is evicted). Scenarios: hit, miss.
   */
  "cache-aside-read": {
    params: { capacity: { min: 1, max: 6, default: 3 } },
    build: (p) => {
      const capacity = p.capacity ?? 3;
      const init = ["b", "c", "a"].slice(0, capacity);
      const hitKey = init[Math.min(1, init.length - 1)] ?? "b";
      const evicted = init.length === capacity ? init[init.length - 1] : undefined;
      return {
        nodes: [
          n("app", "app", "App", "Checks the cache first, loads from the database on a miss."),
          n(
            "cache",
            "cache",
            `Cache (LRU, ${capacity})`,
            "Holds hot keys most-recent-first; evicts the least recently used when full.",
            {
              type: "lru",
              capacity,
              init,
            },
          ),
          n("db", "db", "Database", "Source of truth; the slow path."),
        ],
        edges: [e("e1", "app", "cache"), e("e2", "cache", "db", "miss")],
        scenarios: [
          {
            id: "hit",
            title: "Cache hit",
            events: [
              send(0, "e1", `GET ${hitKey}`),
              st(900, "cache", "touch", hitKey),
              cap(900, `Hit: ${hitKey} is served from the cache and becomes most recent`),
            ],
          },
          {
            id: "miss",
            title: "Cache miss",
            events: [
              send(0, "e1", "GET d"),
              send(900, "e2", "GET d"),
              st(1800, "cache", "put", "d"),
              cap(
                1800,
                evicted
                  ? `Miss: loaded from the database; ${evicted} was least recent and is evicted`
                  : "Miss: loaded from the database and cached",
              ),
            ],
          },
        ],
      };
    },
  },
  /** cache-aside-write. Parameters: none. State: cache = kv. Scenario: write (write DB, then invalidate). */
  "cache-aside-write": {
    params: {},
    build: () => ({
      nodes: [
        n("app", "app", "App", "Writes to the database, then invalidates the cache."),
        n("cache", "cache", "Cache", "Stale entry is removed after a write.", {
          type: "kv",
          init: { k: "old" },
        }),
        n("db", "db", "Database", "Source of truth; written first."),
      ],
      edges: [e("e1", "app", "db"), e("e2", "app", "cache", "invalidate")],
      scenarios: [
        {
          id: "write",
          title: "Write then invalidate",
          events: [
            send(0, "e1", "PUT k"),
            send(900, "e2", "DEL k"),
            st(1800, "cache", "delete", "k"),
            cap(1800, "Cache entry invalidated; the next read reloads it"),
          ],
        },
      ],
    }),
  },
  /**
   * load-balancer. Parameters: servers (int 2-4, default 2).
   * State: one counter per server (requests handled / open connections). Scenarios: round-robin, least-conn.
   */
  "load-balancer": {
    params: { servers: { min: 2, max: 4, default: 2 } },
    build: (p) => {
      const count = p.servers ?? 2;
      const ids = range(count, "s");
      const edgeOf = (i: number) => `e${i + 2}`;
      const rr: Ev[] = [];
      for (let r = 0; r < count * 2; r++) {
        const at = r * 1800;
        const i = r % count;
        rr.push(
          send(at, "e1", `req ${r + 1}`),
          send(at + 900, edgeOf(i), `req ${r + 1}`),
          st(at + 900, ids[i] as string, "inc"),
        );
      }
      rr.push(
        cap(
          count * 2 * 1800 - 900,
          "Requests rotate through the servers in order, so load stays even",
        ),
      );
      // Least-conn: preload open connections (s1=2, s2=0, s3=1, s4=2), then route to the lightest server.
      const preload = [2, 0, 1, 2];
      const lc: Ev[] = ids.flatMap((id, i) =>
        (preload[i] ?? 0) > 0 ? [st(0, id, "inc", undefined, String(preload[i]))] : [],
      );
      lc.push(cap(0, "Open connections: server 1 has 2, server 2 has 0"));
      for (let r = 0; r < 2; r++) {
        const at = 1000 + r * 1800;
        lc.push(
          send(at, "e1", `req ${r + 1}`),
          send(at + 900, edgeOf(1), `req ${r + 1}`),
          st(at + 900, "s2", "inc"),
        );
      }
      lc.push(
        cap(4500, "Least-connections keeps picking the lightest server until counts even out"),
      );
      return {
        nodes: [
          n("client", "client", "Client", "Sends requests."),
          n("lb", "lb", "Load balancer", "Spreads requests across servers."),
          ...ids.map((id, i) =>
            n(id, "app", `Server ${i + 1}`, "Handles requests; the counter shows its load.", {
              type: "counter",
              init: 0,
            }),
          ),
        ],
        edges: [e("e1", "client", "lb"), ...ids.map((id, i) => e(edgeOf(i), "lb", id))],
        scenarios: [
          { id: "round-robin", title: "Round robin", events: rr },
          { id: "least-conn", title: "Least connections", events: lc },
        ],
      };
    },
  },
  /**
   * leader-follower. Parameters: followers (int 1-3, default 1).
   * State: queue (write log) on the leader and every follower. Scenarios: replicate, stale-read.
   */
  "leader-follower": {
    params: { followers: { min: 1, max: 3, default: 1 } },
    build: (p) => {
      const count = p.followers ?? 1;
      const fs = range(count, "f");
      const log = (): Node["state"] => ({ type: "queue", init: [] });
      const rep = (at: number, key: string): Ev[] => [
        ...fs.map((_, i) => send(at, `r${i + 1}`, `write ${key}`, "replicate")),
        ...fs.map((f) => st(at + 900, f, "push", key)),
      ];
      return {
        nodes: [
          n("client", "client", "Client", "Writes go to the leader."),
          n("leader", "db", "Leader", "Accepts writes, logs them and replicates.", log()),
          ...fs.map((f, i) =>
            n(f, "db", `Follower ${i + 1}`, "Applies the leader's log; serves reads.", log()),
          ),
        ],
        edges: [
          e("e1", "client", "leader"),
          ...fs.map((_, i) => e(`r${i + 1}`, "leader", `f${i + 1}`, "replicate")),
          e("read", "client", "f1", "read"),
        ],
        scenarios: [
          {
            id: "replicate",
            title: "Replicate a write",
            events: [
              send(0, "e1", "write x"),
              st(900, "leader", "push", "x"),
              ...rep(1000, "x"),
              cap(1900, "Followers apply the write after the leader"),
            ],
          },
          {
            id: "stale-read",
            title: "Stale read from a follower",
            events: [
              send(0, "e1", "write y"),
              st(900, "leader", "push", "y"),
              send(1000, "read", "read y"),
              cap(1900, "A follower read before replication returns old data"),
              ...rep(2600, "y"),
              cap(3500, "Once replicated, the follower catches up"),
            ],
          },
        ],
      };
    },
  },
  /**
   * producer-consumer. Parameters: jobs (int 0-4, default 1, jobs already queued as j1..jN).
   * State: queue (FIFO). Scenarios: flow (one in, one out), burst (two in, one out).
   */
  "producer-consumer": {
    params: { jobs: { min: 0, max: 4, default: 1 } },
    build: (p) => {
      const jobs = p.jobs ?? 1;
      const init = range(jobs, "j");
      const nx = jobs + 1;
      return {
        nodes: [
          n("producer", "app", "Producer", "Enqueues jobs."),
          n("queue", "queue", "Queue", "Buffers jobs in arrival order (FIFO).", {
            type: "queue",
            init,
          }),
          n("worker", "worker", "Worker", "Takes the oldest job."),
        ],
        edges: [e("e1", "producer", "queue"), e("e2", "queue", "worker")],
        scenarios: [
          {
            id: "flow",
            title: "Enqueue and consume",
            events: [
              send(0, "e1", `j${nx}`),
              st(800, "queue", "push", `j${nx}`),
              send(1500, "e2", init[0] ?? `j${nx}`),
              st(2300, "queue", "pop"),
              cap(2300, "Jobs leave the queue in arrival order"),
            ],
          },
          {
            id: "burst",
            title: "Burst of jobs",
            events: [
              send(0, "e1", `j${nx}`),
              st(800, "queue", "push", `j${nx}`),
              send(900, "e1", `j${nx + 1}`),
              st(1700, "queue", "push", `j${nx + 1}`),
              cap(1700, "The queue absorbs a burst while the worker is busy"),
              send(2500, "e2", init[0] ?? `j${nx}`),
              st(3300, "queue", "pop"),
              cap(3300, "The worker still takes the oldest job first"),
            ],
          },
        ],
      };
    },
  },
  /**
   * consistent-hash-ring. Parameters: nodes (int 2-5, default 2, ring members n1..nN).
   * State: ring (members), placement = kv (key -> owner). Scenarios: add-node, remove-node.
   */
  "consistent-hash-ring": {
    params: { nodes: { min: 2, max: 5, default: 2 } },
    build: (p) => {
      const count = p.nodes ?? 2;
      const members = range(count, "n");
      const keys = range(4, "k");
      const placement = Object.fromEntries(keys.map((k, i) => [k, members[i % count] as string]));
      const added = `n${count + 1}`;
      const leaving = "n1";
      const moved = keys.filter((k) => placement[k] === leaving);
      return {
        nodes: [
          n("client", "client", "Client", "Looks up a key."),
          n(
            "ring",
            "store",
            "Hash ring",
            "Nodes are placed around the ring; a key belongs to the next node clockwise.",
            {
              type: "ring",
              init: members,
            },
          ),
          n("placement", "store", "Key owners", "Which node currently owns each key.", {
            type: "kv",
            init: placement,
          }),
          n(
            added,
            "db",
            `New node ${added}`,
            "Joins the ring and takes over part of one neighbour's keys.",
          ),
        ],
        edges: [e("e1", "client", "ring"), e("e2", "ring", added, "join")],
        scenarios: [
          {
            id: "add-node",
            title: "Add a node",
            events: [
              send(0, "e1", "key k2"),
              send(1000, "e2", added, "replicate"),
              st(1800, "ring", "add", added),
              st(1800, "placement", "set", "k2", added),
              cap(1800, "Only a slice of keys (k2) moves to the new node"),
            ],
          },
          {
            id: "remove-node",
            title: "Remove a node",
            events: [
              send(0, "e1", `key ${moved[0] ?? "k1"}`),
              st(900, "ring", "remove", leaving),
              ...moved.map((k) => st(900, "placement", "set", k, "n2")),
              cap(900, "Only the removed node's keys move, to its clockwise neighbour"),
            ],
          },
        ],
      };
    },
  },
  /**
   * sharded-lookup. Parameters: shards (int 2-4, default 2; keys split by first letter).
   * State: router = kv (sample key -> shard). Scenarios: lookup (kiwi), lookup-last (zebra).
   */
  "sharded-lookup": {
    params: { shards: { min: 2, max: 4, default: 2 } },
    build: (p) => {
      const count = p.shards ?? 2;
      const owner = (key: string) =>
        Math.min(count - 1, Math.floor(((key.charCodeAt(0) - 97) * count) / 26));
      const samples = ["apple", "kiwi", "pear", "zebra"];
      const route = (key: string): Scenario["events"] => [
        send(0, "e1", `key ${key}`),
        send(900, `e${owner(key) + 2}`, `key ${key}`),
        cap(900, `Router sends "${key}" to shard ${owner(key) + 1}, which owns its letter range`),
      ];
      return {
        nodes: [
          n("client", "client", "Client", "Looks up a key."),
          n("router", "app", "Router", "Maps a key to the shard that owns it.", {
            type: "kv",
            init: Object.fromEntries(samples.map((k) => [k, `shard${owner(k) + 1}`])),
          }),
          ...range(count, "shard").map((id, i) =>
            n(id, "db", `Shard ${i + 1}`, "Holds one slice of the key space."),
          ),
        ],
        edges: [
          e("e1", "client", "router"),
          ...range(count, "shard").map((id, i) => e(`e${i + 2}`, "router", id)),
        ],
        scenarios: [
          { id: "lookup", title: "Route a key", events: route("kiwi") },
          { id: "lookup-last", title: "Route a late key", events: route("zebra") },
        ],
      };
    },
  },
};

// Legacy alias, kept because committed content/ still uses `cache-aside` for the read flow.
TEMPLATES["cache-aside"] = TEMPLATES["cache-aside-read"] as Template;

export const TEMPLATE_NAMES: readonly string[] = Object.keys(TEMPLATES);

export type CompileInput = {
  id: string;
  template: string;
  parameters?: Record<string, unknown>;
  overrides?: Partial<Sim>;
};
export type CompileResult = { ok: true; sim: Sim } | { ok: false; errors: string[] };

export function compileTemplate(input: CompileInput): CompileResult {
  const tpl = Object.hasOwn(TEMPLATES, input.template) ? TEMPLATES[input.template] : undefined;
  if (!tpl) return { ok: false, errors: [`unknown template "${input.template}"`] };
  const errors: string[] = [];
  const params: Params = {};
  for (const [k, spec] of Object.entries(tpl.params)) params[k] = spec.default;
  for (const [k, v] of Object.entries(input.parameters ?? {})) {
    const spec = Object.hasOwn(tpl.params, k) ? tpl.params[k] : undefined;
    if (!spec) errors.push(`template "${input.template}": unknown parameter "${k}"`);
    else if (typeof v !== "number")
      errors.push(`template "${input.template}": parameter "${k}" must be a number`);
    else if (!Number.isInteger(v) || v < spec.min || v > spec.max)
      errors.push(
        `template "${input.template}": parameter "${k}" must be an integer from ${spec.min} to ${spec.max}`,
      );
    else params[k] = v;
  }
  if (errors.length) return { ok: false, errors };
  const base = tpl.build(params);
  const lastAt = Math.max(...base.scenarios.flatMap((s) => s.events.map((ev) => ev.at)));
  const sim = {
    id: input.id,
    template: input.template,
    loop: true,
    durationMs: lastAt + 1500,
    ...base,
    src: { kind: "gap", note: `Compiled from template ${input.template}; not drawn from a guide.` },
    ...input.overrides,
  };
  const parsed = SimSchema.safeParse(sim);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `template "${input.template}": ${i.path.join(".") || "sim"}: ${i.message}`,
      ),
    };
  return { ok: true, sim: parsed.data };
}

export type SimRefInput = Sim | TemplateSim | { ref: string };

/** Count of sims that come from a template (ADR-0015 exit criterion (e)). */
export const countTemplateSims = (sims: readonly { template?: string }[]): number =>
  sims.filter((s) => s.template !== undefined).length;

export function resolveSimRef(
  simOrRef: SimRefInput,
  sharedSims: Sim[],
): { ok: true; sim: Sim } | { ok: false; errors: string[] } {
  if ("ref" in simOrRef) {
    const found = sharedSims.find((s) => s.id === simOrRef.ref);
    if (!found)
      return { ok: false, errors: [`sim ref "${simOrRef.ref}" not found in shared sims`] };
    return { ok: true, sim: found };
  }
  if (!("nodes" in simOrRef))
    return compileTemplate({
      id: simOrRef.id,
      template: simOrRef.template,
      parameters: simOrRef.parameters,
      overrides: simOrRef.overrides as Partial<Sim> | undefined, // validated by SimSchema inside compileTemplate
    });
  return { ok: true, sim: simOrRef };
}
