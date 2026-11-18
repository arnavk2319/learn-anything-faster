import { describe, expect, it } from "vitest";
import { feedbackRequestSchema, hashClientId, normalizeNote } from "./schemas";

const ok = {
  clientId: "3f2b1c4e-5a6d-4e8f-9a0b-1c2d3e4f5a6b",
  trackId: "system-design",
  targetKind: "concept",
  targetId: "caching",
  rating: 5,
};

describe("feedbackRequestSchema", () => {
  it("accepts a valid vote and a retract", () => {
    expect(feedbackRequestSchema.safeParse(ok).success).toBe(true);
    expect(feedbackRequestSchema.safeParse({ ...ok, rating: null }).success).toBe(true);
  });
  it.each([
    ["bad kind", { targetKind: "page" }],
    ["rating 3", { rating: 3 }],
    ["not a uuid", { clientId: "abc" }],
    ["empty target", { targetId: "" }],
    ["long target", { targetId: "a".repeat(201) }],
    ["bad track slug", { trackId: "Sys Design" }],
    ["long note", { rating: 1, note: "x".repeat(281) }],
    ["extra key", { email: "a" }],
  ])("rejects %s", (_n, patch) => {
    expect(feedbackRequestSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
  it("accepts a 280 char note", () => {
    expect(
      feedbackRequestSchema.safeParse({ ...ok, rating: 1, note: "x".repeat(280) }).success,
    ).toBe(true);
  });
});

describe("hashClientId", () => {
  it("is 64 hex and does not contain the id", () => {
    const h = hashClientId(ok.clientId);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(ok.clientId);
  });
});

describe("normalizeNote", () => {
  it("keeps a trimmed note only with rating 1", () => {
    expect(normalizeNote("  wrong step ", 1)).toBe("wrong step");
    expect(normalizeNote("wrong", 5)).toBeNull();
    expect(normalizeNote("wrong", null)).toBeNull();
  });
  it("strips control characters and nulls empty", () => {
    expect(normalizeNote("a\u0000b\u0007c", 1)).toBe("abc");
    expect(normalizeNote(" \u0001 ", 1)).toBeNull();
    expect(normalizeNote(undefined, 1)).toBeNull();
  });
});
