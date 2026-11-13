// Template compiler skeleton (ADR-0015 section 2): template + parameters + overrides -> full Sim.
// Pure; compileTemplate never throws. TEMPLATE_NAMES is the registry the content validator consumes.
import { SimSchema, type Sim } from "../schemas";

type Node = Sim["nodes"][number];
type Edge = Sim["edges"][number];
type Scenario = Sim["scenarios"][number];
type Base = { nodes: Node[]; edges: Edge[]; scenarios: Scenario[]; durationMs: number };
type ParamSpec = "number" | "string" | "boolean";
type Template = { params: Record<string, ParamSpec>; build: (p: Record<string, unknown>) => Base };

const n = (id: string, kind: Node["kind"], label: string, inspect: string, state?: Node["state"]): Node =>
  state ? { id, kind, label, inspect, state } : { id, kind, label, inspect };
const e = (id: string, from: string, to: string, label?: string): Edge =>
  label ? { id, from, to, label } : { id, from, to };

const TEMPLATES: Record<string, Template> = {
  "cache-aside-read": {
    params: { capacity: "number" },
    build: (p) => ({
      durationMs: 6000,
      nodes: [
        n("app", "app", "App", "Checks the cache first, loads from the database on a miss."),
        n("cache", "cache", "Cache", "Holds hot keys; evicts the least recently used when full.", {
          type: "lru",
          capacity: typeof p.capacity === "number" ? p.capacity : 3,
          init: ["b", "c", "a"],
        }),
        n("db", "db", "Database", "Source of truth; the slow path."),
      ],
      edges: [e("e1", "app", "cache"), e("e2", "cache", "db", "miss")],
      scenarios: [
        {
          id: "miss",
          title: "Cache miss",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "GET d", color: "request" } } },
            { at: 900, send: { edge: "e2", token: { label: "GET d", color: "request" } } },
            { at: 1800, state: { node: "cache", op: "put", key: "d" } },
            { at: 1800, caption: "Miss: loaded from the database and cached" },
          ],
        },
      ],
    }),
  },
  "cache-aside-write": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("app", "app", "App", "Writes to the database, then invalidates the cache."),
        n("cache", "cache", "Cache", "Stale entry is removed after a write.", { type: "kv", init: { k: "old" } }),
        n("db", "db", "Database", "Source of truth; written first."),
      ],
      edges: [e("e1", "app", "db"), e("e2", "app", "cache", "invalidate")],
      scenarios: [
        {
          id: "write",
          title: "Write then invalidate",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "PUT k", color: "request" } } },
            { at: 900, send: { edge: "e2", token: { label: "DEL k", color: "request" } } },
            { at: 1800, state: { node: "cache", op: "delete", key: "k" } },
            { at: 1800, caption: "Cache entry invalidated; next read reloads it" },
          ],
        },
      ],
    }),
  },
  "load-balancer": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("client", "client", "Client", "Sends requests."),
        n("lb", "lb", "Load balancer", "Spreads requests across servers."),
        n("s1", "app", "Server 1", "Handles requests."),
        n("s2", "app", "Server 2", "Handles requests."),
        n("count", "store", "Server 1 hits", "Requests routed to server 1.", { type: "counter", init: 0 }),
      ],
      edges: [e("e1", "client", "lb"), e("e2", "lb", "s1"), e("e3", "lb", "s2")],
      scenarios: [
        {
          id: "round-robin",
          title: "Round robin",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "req 1", color: "request" } } },
            { at: 900, send: { edge: "e2", token: { label: "req 1", color: "request" } } },
            { at: 900, state: { node: "count", op: "inc" } },
            { at: 2000, send: { edge: "e1", token: { label: "req 2", color: "request" } } },
            { at: 2900, send: { edge: "e3", token: { label: "req 2", color: "request" } } },
            { at: 2900, caption: "Requests alternate between servers" },
          ],
        },
      ],
    }),
  },
  "leader-follower": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("client", "client", "Client", "Writes go to the leader."),
        n("leader", "db", "Leader", "Accepts writes and replicates them."),
        n("follower", "db", "Follower", "Applies the leader's changes; serves reads."),
        n("log", "store", "Follower log", "Entries applied on the follower.", { type: "queue", init: [] }),
      ],
      edges: [e("e1", "client", "leader"), e("e2", "leader", "follower", "replicate")],
      scenarios: [
        {
          id: "replicate",
          title: "Replicate a write",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "write x", color: "request" } } },
            { at: 900, send: { edge: "e2", token: { label: "write x", color: "replicate" } } },
            { at: 1800, state: { node: "log", op: "push", key: "x" } },
            { at: 1800, caption: "Follower applies the write after the leader" },
          ],
        },
      ],
    }),
  },
  "producer-consumer": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("producer", "app", "Producer", "Enqueues jobs."),
        n("queue", "queue", "Queue", "Buffers jobs in order.", { type: "queue", init: ["j1"] }),
        n("worker", "worker", "Worker", "Takes the oldest job."),
      ],
      edges: [e("e1", "producer", "queue"), e("e2", "queue", "worker")],
      scenarios: [
        {
          id: "flow",
          title: "Enqueue and consume",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "j2", color: "request" } } },
            { at: 800, state: { node: "queue", op: "push", key: "j2" } },
            { at: 1500, send: { edge: "e2", token: { label: "j1", color: "request" } } },
            { at: 2300, state: { node: "queue", op: "pop" } },
            { at: 2300, caption: "Jobs leave the queue in arrival order" },
          ],
        },
      ],
    }),
  },
  "consistent-hash-ring": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("client", "client", "Client", "Looks up a key."),
        n("ring", "store", "Hash ring", "Nodes placed around the ring.", { type: "ring", init: ["n1", "n2"] }),
        n("n3", "db", "New node n3", "Joins the ring and takes over part of one neighbour's keys."),
      ],
      edges: [e("e1", "client", "ring"), e("e2", "ring", "n3", "join")],
      scenarios: [
        {
          id: "add-node",
          title: "Add a node",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "key k", color: "request" } } },
            { at: 1000, send: { edge: "e2", token: { label: "n3", color: "replicate" } } },
            { at: 1800, state: { node: "ring", op: "add", key: "n3" } },
            { at: 1800, caption: "Only a slice of keys moves to the new node" },
          ],
        },
      ],
    }),
  },
  "sharded-lookup": {
    params: {},
    build: () => ({
      durationMs: 6000,
      nodes: [
        n("client", "client", "Client", "Looks up a key."),
        n("router", "app", "Router", "Maps a key to a shard.", {
          type: "kv",
          init: { "a-m": "shard1", "n-z": "shard2" },
        }),
        n("shard1", "db", "Shard 1", "Holds keys a to m."),
        n("shard2", "db", "Shard 2", "Holds keys n to z."),
      ],
      edges: [e("e1", "client", "router"), e("e2", "router", "shard1"), e("e3", "router", "shard2")],
      scenarios: [
        {
          id: "lookup",
          title: "Route a key",
          events: [
            { at: 0, send: { edge: "e1", token: { label: "key cat", color: "request" } } },
            { at: 900, send: { edge: "e2", token: { label: "key cat", color: "request" } } },
            { at: 900, caption: "Router sends the key to the shard that owns it" },
          ],
        },
      ],
    }),
  },
};

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
  for (const [k, v] of Object.entries(input.parameters ?? {})) {
    const want = Object.hasOwn(tpl.params, k) ? tpl.params[k] : undefined;
    if (!want) errors.push(`template "${input.template}": unknown parameter "${k}"`);
    else if (typeof v !== want)
      errors.push(`template "${input.template}": parameter "${k}" must be a ${want}`);
  }
  if (errors.length) return { ok: false, errors };
  const base = tpl.build(input.parameters ?? {});
  const sim = {
    id: input.id,
    template: input.template,
    loop: true,
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

export type SimRefInput = Sim | { ref: string };

export function resolveSimRef(
  simOrRef: SimRefInput,
  sharedSims: Sim[],
): { ok: true; sim: Sim } | { ok: false; errors: string[] } {
  let sim: Sim;
  if ("ref" in simOrRef) {
    const found = sharedSims.find((s) => s.id === simOrRef.ref);
    if (!found) return { ok: false, errors: [`sim ref "${simOrRef.ref}" not found in shared sims`] };
    sim = found;
  } else sim = simOrRef;
  return { ok: true, sim };
}
