/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate raw, intentionally untyped packs into malformed shapes */
// Fixtures for the Learn content validator (T-039). In-memory raw objects (pre-Zod), cloned per test.
// Mutate a clone with `makePack()` then pass to parsePack/validateLearn. Never import from content/.
import { createHash } from "node:crypto";

// Contract: denylist hashes are sha256 hex of the lowercased term; validate.ts exports the same as hashTerm().
const hashTerm = (t: string) => createHash("sha256").update(t.toLowerCase()).digest("hex");

export const GUIDE_ID = "system-design-concepts";
export const GUIDE_MD = [
  "# System design concepts",
  "",
  "## 1. Caching ★",
  "",
  "Cache-aside means the **application** loads data on a miss and fills the cache.",
  "An LRU cache evicts the `least recently used` key when it is full.",
  "",
  "## 2. Load balancing",
  "",
  "A load balancer spreads requests across healthy servers using round robin or least connections.",
  "",
].join("\n");
export const Q_CACHE = "Cache-aside means the **application** loads data on a miss";
export const Q_LB = "spreads requests across healthy servers";

export const guideSrc = (quote = Q_CACHE, heading = "Caching") => ({
  kind: "guide",
  guide: GUIDE_ID,
  heading,
  quote,
});
export const gapSrc = () => ({ kind: "gap", note: "Not stated in the guide; illustrative." });

export const goodSim = (id = "cache-aside-read") => ({
  id,
  template: "cache-aside",
  durationMs: 9000,
  loop: true,
  nodes: [
    { id: "app", kind: "app", label: "App", inspect: "Reads the cache first." },
    {
      id: "cache",
      kind: "cache",
      label: "Cache (LRU, 3)",
      state: { type: "lru", capacity: 3, init: ["b", "c", "a"] },
      inspect: "Holds hot keys in recency order.",
    },
    { id: "db", kind: "db", label: "Database", inspect: "Source of truth." },
  ],
  edges: [
    { id: "e1", from: "app", to: "cache" },
    { id: "e2", from: "cache", to: "db", label: "miss" },
  ],
  scenarios: [
    {
      id: "hit",
      title: "Cache hit",
      events: [
        { at: 0, send: { edge: "e1", token: { label: "GET c", color: "request" } } },
        { at: 800, state: { node: "cache", op: "touch", key: "c" } },
        { at: 1600, caption: "Served from the cache." },
      ],
    },
  ],
  src: guideSrc(),
});

const baseQ = (id: string, extra: Record<string, unknown>) => ({
  id,
  conceptId: "caching",
  relatedConceptIds: [],
  status: "approved",
  level: "basic",
  retired: false,
  prompt: "Which pattern loads data on a miss?",
  explanation: "The application owns the read-through on a miss.",
  difficulty: 2,
  tags: ["caching"],
  src: guideSrc(),
  ...extra,
});
const opts = (...ids: string[]) => ids.map((id) => ({ id, text: `Choice ${id}` }));

export function makePack(): any /* raw fixture, intentionally untyped: tests mutate it into malformed shapes */ {
  return {
    track: {
      id: "system-design",
      title: "System design",
      summary: "Design large systems.",
      category: "engineering",
      status: "live",
      order: 1,
    },
    concepts: [
      {
        id: "caching",
        trackId: "system-design",
        title: "Caching",
        summary: "Where caches sit and how they evict.",
        stage: "basic",
        order: 1,
        topicIds: [],
        prerequisites: [],
        status: "approved",
        sim: goodSim(),
        levels: {
          basic: [
            { id: "caching-text", type: "text", body: "Cache-aside loads on a miss. p95 < 200ms and x > y is fine.", src: guideSrc() },
            {
              id: "caching-table",
              type: "table",
              columns: ["Pattern", "Writes"],
              rows: [["Cache-aside", "App"], ["Write-through", "Cache"]],
              src: guideSrc(),
            },
            { id: "caching-sim", type: "sim", ref: "cache-aside-read", src: guideSrc() },
            { id: "caching-quiz", type: "quiz", questionIds: ["q-caching-1", "q-caching-2"], src: guideSrc() },
            {
              id: "caching-faq",
              type: "faq",
              items: [{ q: "What is cache-aside?", a: "App loads on a miss.", src: guideSrc() }],
            },
          ],
        },
      },
    ],
    problems: [
      {
        id: "url-shortener",
        trackId: "system-design",
        title: "URL shortener",
        summary: "Short codes at scale.",
        difficulty: "easy",
        priority: true,
        conceptIds: ["caching"],
        topicIds: [],
        status: "approved",
        sim: { ref: "shared-lb" },
        blocks: [
          { id: "us-text", type: "text", body: "Spread requests across servers.", src: guideSrc(Q_LB, "Load balancing") },
          { id: "us-sim", type: "sim", ref: "shared-lb", src: guideSrc(Q_LB, "Load balancing") },
        ],
      },
    ],
    questions: [
      baseQ("q-caching-1", { type: "mcq", options: opts("a", "b", "c"), answer: ["b"] }),
      baseQ("q-caching-2", { type: "multi", options: opts("a", "b", "c"), answer: ["a", "c"] }),
      baseQ("q-caching-3", { type: "ordering", options: opts("a", "b", "c"), answer: ["c", "a", "b"] }),
      baseQ("q-caching-4", {
        type: "short-explain",
        answer: "The app loads from the database on a miss and fills the cache.",
        rubric: ["Names cache-aside"],
      }),
      baseQ("q-url-shortener-1", {
        conceptId: undefined,
        problemId: "url-shortener",
        relatedConceptIds: ["caching"],
        type: "short-explain",
        answer: "Counter plus base62.",
        src: guideSrc(Q_LB, "Load balancing"),
      }),
      baseQ("q-caching-5", { type: "mcq", options: opts("a", "b"), answer: ["a"], status: "proposed" }),
    ],
    sets: [
      {
        id: "set-mixed-1",
        trackId: "system-design",
        title: "Mixed",
        summary: "A mix.",
        kind: "mixed",
        conceptIds: ["caching"],
        order: 1,
        questionIds: ["q-caching-1", "q-url-shortener-1"],
      },
    ],
    sims: [{ ...goodSim("shared-lb"), template: undefined, src: guideSrc(Q_LB, "Load balancing") }],
    guides: { [GUIDE_ID]: GUIDE_MD },
    previousApprovedIds: [] as string[],
    templates: ["cache-aside", "load-balancer"],
    denylist: { terms: ["acmecorp"], hashes: [hashTerm("globex")] },
  };
}

/** Add n grounded approved short-explain questions (to dilute the gap ratio). */
export function addGrounded(pack: any, n: number) {
  for (let i = 0; i < n; i++) {
    pack.questions.push(
      baseQ(`q-caching-g${i}`, { type: "short-explain", answer: "Model answer.", rubric: ["x"] }),
    );
  }
}
/** Turn the first n questions with a guide src into gap questions. */
export function makeGaps(pack: any, n: number, from = 0) {
  const qs = pack.questions.filter((q: any) => q.status === "approved" && q.src.kind === "guide");
  qs.slice(from, from + n).forEach((q: any) => (q.src = gapSrc()));
}
