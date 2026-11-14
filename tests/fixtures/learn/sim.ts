import type { Sim } from "../../../apps/web/lib/learn/schemas";

/** The ADR-0015 section 2 LRU example, with a second counter node so every scenario has non-trivial state. */
export const lruSim = (): Sim => ({
  id: "lru-cache-read",
  durationMs: 9000,
  loop: true,
  nodes: [
    { id: "app", kind: "app", label: "App", inspect: "Calls the cache first." },
    {
      id: "cache",
      kind: "cache",
      label: "LRU cache (3)",
      state: { type: "lru", capacity: 3, init: ["b", "c", "a"] },
      inspect: "Holds hot keys in recency order; evicts the least recently used when full.",
    },
    { id: "hit", kind: "decision", label: "Hit?", inspect: "Is the key in the cache?" },
    { id: "db", kind: "db", label: "Database", inspect: "Source of truth; slow path." },
    {
      id: "hits",
      kind: "store",
      label: "Hit counter",
      state: { type: "counter", init: 0 },
      inspect: "Counts cache hits.",
    },
  ],
  edges: [
    { id: "e1", from: "app", to: "cache" },
    { id: "e2", from: "cache", to: "hit" },
    { id: "e3", from: "hit", to: "db", label: "miss" },
  ],
  scenarios: [
    {
      id: "hit",
      title: "Cache hit",
      events: [
        { at: 0, send: { edge: "e1", token: { label: "GET c", color: "request" } } },
        { at: 800, decide: { node: "hit", result: "yes" } },
        { at: 800, state: { node: "cache", op: "touch", key: "c" } },
        { at: 800, state: { node: "hits", op: "inc" } },
        { at: 800, highlight: { node: "cache" } },
        { at: 1600, caption: "c is moved to most-recent; DB untouched" },
      ],
    },
    {
      id: "miss-evict",
      title: "Miss + eviction",
      events: [
        { at: 0, send: { edge: "e1", token: { label: "GET d" } } },
        { at: 800, decide: { node: "hit", result: "no" } },
        { at: 900, send: { edge: "e3", token: { label: "GET d" } } },
        { at: 2200, state: { node: "cache", op: "put", key: "d" } },
        { at: 2200, caption: "a evicted (least recent)" },
        { at: 1000, caption: "Miss: go to the database" },
        { at: 3000, spawn: { node: "app", token: { label: "d value", color: "response" } } },
        { at: 4000, remove: { token: "d value" } },
      ],
    },
  ],
  src: { kind: "gap", note: "eviction order is not spelled out in the guide" },
});
