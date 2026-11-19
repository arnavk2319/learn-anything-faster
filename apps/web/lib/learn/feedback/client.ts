// Client side of anonymous feedback (ADR-0017): own-vote store, random client id, offline queue. Pure helpers
// (no React); the storage wrappers are SSR-safe. Types only come from ./schemas because that module imports
// node:crypto, which must not reach the browser bundle.
import type { FeedbackRequest, FeedbackTargetKind } from "./schemas";

export const FEEDBACK_KEY = "laf:learn:fb:v1";
/** Mirrors NOTE_MAX in ./schemas (a unit test pins the equality). */
export const NOTE_MAX_UI = 280;
export const QUEUE_MAX = 20;
export const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Rating = 1 | 5;
export type QueuedVote = {
  trackId: string;
  targetKind: FeedbackTargetKind;
  targetId: string;
  rating: Rating | null;
  at: number;
};
export type FeedbackState = {
  v: 1;
  clientId: string;
  votes: Record<string, Rating>;
  queue: QueuedVote[];
};

export const targetKey = (trackId: string, kind: string, id: string): string =>
  `${trackId}|${kind}|${id}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Random v4 UUID: crypto.randomUUID, else getRandomValues, else Math.random (insecure contexts, old browsers). */
export function newClientId(
  c: Pick<Crypto, "randomUUID" | "getRandomValues"> | undefined = globalThis.crypto,
): string {
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const emptyState = (clientId: string = newClientId()): FeedbackState => ({
  v: 1,
  clientId,
  votes: {},
  queue: [],
});

/** Tolerant parse of the stored blob; anything malformed is dropped, never thrown. */
export function parseState(raw: string | null, mkId: () => string = newClientId): FeedbackState {
  if (!raw) return emptyState(mkId());
  try {
    const o = JSON.parse(raw) as Partial<FeedbackState> | null;
    if (!o || o.v !== 1 || typeof o.clientId !== "string" || !UUID_RE.test(o.clientId))
      return emptyState(mkId());
    const votes: Record<string, Rating> = {};
    for (const [k, r] of Object.entries(o.votes ?? {})) if (r === 1 || r === 5) votes[k] = r;
    const queue = Array.isArray(o.queue)
      ? o.queue.filter(
          (q): q is QueuedVote =>
            !!q &&
            typeof q.trackId === "string" &&
            typeof q.targetKind === "string" &&
            typeof q.targetId === "string" &&
            (q.rating === 1 || q.rating === 5 || q.rating === null) &&
            typeof q.at === "number",
        )
      : [];
    return { v: 1, clientId: o.clientId, votes, queue: queue.slice(-QUEUE_MAX) };
  } catch {
    return emptyState(mkId());
  }
}

const sameTarget = (a: QueuedVote, b: QueuedVote) =>
  a.trackId === b.trackId && a.targetKind === b.targetKind && a.targetId === b.targetId;

/** Drops entries older than 7 days. */
export const pruneQueue = (q: QueuedVote[], now: number): QueuedVote[] =>
  q.filter((e) => now - e.at <= QUEUE_TTL_MS);

/** Latest vote per target wins; the queue holds at most QUEUE_MAX entries (oldest dropped). Never holds a note. */
export function enqueue(q: QueuedVote[], e: QueuedVote, now: number): QueuedVote[] {
  return [...pruneQueue(q, now).filter((x) => !sameTarget(x, e)), e].slice(-QUEUE_MAX);
}

/** Records the visitor's own vote (null retracts). */
export function setVote(s: FeedbackState, key: string, rating: Rating | null): FeedbackState {
  const votes = { ...s.votes };
  if (rating === null) delete votes[key];
  else votes[key] = rating;
  return { ...s, votes };
}

export const toRequest = (clientId: string, e: QueuedVote): FeedbackRequest => ({
  clientId,
  trackId: e.trackId,
  targetKind: e.targetKind,
  targetId: e.targetId,
  rating: e.rating,
});

export function loadState(): FeedbackState {
  if (typeof localStorage === "undefined") return emptyState();
  try {
    const s = parseState(localStorage.getItem(FEEDBACK_KEY));
    return { ...s, queue: pruneQueue(s.queue, Date.now()) };
  } catch {
    return emptyState();
  }
}

export function saveState(s: FeedbackState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: the vote still works for this page view
  }
}

export type SendResult = "ok" | "rate_limited" | "unavailable" | "invalid";

export async function postFeedback(
  req: FeedbackRequest,
  f: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await f("/api/learn/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.ok) return "ok";
    if (res.status === 429) return "rate_limited";
    if (res.status === 400 || res.status === 403) return "invalid";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

let flushing = false;
/** Retries queued votes in order; stops at the first transient failure. Invalid entries are dropped. No-op when empty. */
export async function flushQueue(f: typeof fetch = fetch): Promise<void> {
  if (flushing) return;
  let s = loadState();
  if (s.queue.length === 0) return;
  flushing = true;
  try {
    for (const e of [...s.queue]) {
      const r = await postFeedback(toRequest(s.clientId, e), f);
      if (r === "rate_limited" || r === "unavailable") break;
      s = loadState();
      s = { ...s, queue: s.queue.filter((x) => !(x.at === e.at && sameTarget(x, e))) };
      saveState(s);
    }
  } finally {
    flushing = false;
  }
}
