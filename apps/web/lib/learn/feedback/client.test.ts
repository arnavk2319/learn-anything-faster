import { afterEach, describe, expect, it } from "vitest";
import { NOTE_MAX } from "./schemas";
import {
  FEEDBACK_KEY,
  NOTE_MAX_UI,
  QUEUE_MAX,
  QUEUE_TTL_MS,
  emptyState,
  enqueue,
  loadState,
  newClientId,
  parseState,
  pruneQueue,
  setVote,
  targetKey,
  type QueuedVote,
} from "./client";
import { initialVote, noteAllowed, voteReducer } from "./vote";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const q = (id: string, at: number, rating: 1 | 5 | null = 5): QueuedVote => ({
  trackId: "system-design",
  targetKind: "question",
  targetId: id,
  rating,
  at,
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("client id", () => {
  it("uses randomUUID when present", () => {
    expect(newClientId({ randomUUID: () => "x" } as unknown as Crypto)).toBe("x");
  });
  it("falls back to getRandomValues and to Math.random with a valid v4 shape", () => {
    const g = { getRandomValues: (b: Uint8Array) => b.fill(7) } as unknown as Crypto;
    expect(newClientId(g)).toMatch(UUID);
    expect(newClientId(undefined)).toMatch(UUID);
  });
});

describe("state", () => {
  it("ui note max equals the server max", () => expect(NOTE_MAX_UI).toBe(NOTE_MAX));
  it("is SSR safe: no localStorage means an empty state", () => {
    const s = loadState();
    expect(s.votes).toEqual({});
    expect(s.queue).toEqual([]);
  });
  it("parses tolerantly and replaces garbage", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(parseState("nope").queue).toEqual([]);
    expect(parseState(JSON.stringify({ v: 1, clientId: "bad" })).clientId).not.toBe("bad");
    const ok = parseState(
      JSON.stringify({ v: 1, clientId: id, votes: { a: 5, b: 3 }, queue: [q("x", 1), { z: 1 }] }),
    );
    expect(ok.clientId).toBe(id);
    expect(ok.votes).toEqual({ a: 5 });
    expect(ok.queue).toHaveLength(1);
  });
  it("sets and retracts a vote", () => {
    const k = targetKey("t", "sim", "s");
    const s = setVote(emptyState("x"), k, 1);
    expect(s.votes[k]).toBe(1);
    expect(setVote(s, k, null).votes).toEqual({});
  });
  it("loads from localStorage", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) =>
        k === FEEDBACK_KEY
          ? JSON.stringify({ v: 1, clientId: id, votes: { k: 5 }, queue: [] })
          : null,
    };
    expect(loadState().votes).toEqual({ k: 5 });
  });
});

describe("queue", () => {
  it("keeps at most 20 entries, dropping the oldest", () => {
    let list: QueuedVote[] = [];
    for (let i = 0; i < 25; i++) list = enqueue(list, q(`q${i}`, 1000 + i), 1000 + i);
    expect(list).toHaveLength(QUEUE_MAX);
    expect(list[0]?.targetId).toBe("q5");
  });
  it("latest vote per target wins", () => {
    const list = enqueue(enqueue([], q("a", 1, 5), 1), q("a", 2, 1), 2);
    expect(list).toEqual([q("a", 2, 1)]);
  });
  it("expires entries after 7 days", () => {
    const now = 10 * QUEUE_TTL_MS;
    expect(
      pruneQueue([q("old", now - QUEUE_TTL_MS - 1), q("new", now - 5)], now).map((e) => e.targetId),
    ).toEqual(["new"]);
  });
  it("never carries a note field", () => {
    expect(Object.keys(q("a", 1))).not.toContain("note");
  });
});

describe("vote reducer", () => {
  it("offers the note only after a not-helpful vote", () => {
    let s = voteReducer(initialVote, { type: "note", text: "hi" });
    expect(s.note).toBe("");
    s = voteReducer(s, { type: "send", vote: 1 });
    expect(noteAllowed(s)).toBe(true);
    s = voteReducer(s, { type: "note", text: "x".repeat(400) });
    expect(s.note).toHaveLength(NOTE_MAX_UI);
    s = voteReducer(s, { type: "send", vote: 5 });
    expect(s.note).toBe("");
    expect(noteAllowed(s)).toBe(false);
  });
  it("maps results to statuses", () => {
    const sent = voteReducer(voteReducer(initialVote, { type: "send", vote: 5 }), {
      type: "result",
      result: "ok",
    });
    expect(sent.status).toBe("sent");
    expect(voteReducer(sent, { type: "result", result: "rate_limited" }).status).toBe("limited");
    expect(voteReducer(sent, { type: "result", result: "unavailable" }).status).toBe("queued");
    const gone = voteReducer(voteReducer(sent, { type: "send", vote: null }), {
      type: "result",
      result: "ok",
    });
    expect(gone.status).toBe("retracted");
    expect(gone.vote).toBeNull();
  });
});
