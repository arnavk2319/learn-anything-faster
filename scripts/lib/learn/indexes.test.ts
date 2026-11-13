/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate raw, intentionally untyped packs into malformed shapes */
import { describe, expect, it } from "vitest";
import { addGrounded, makePack } from "../../../tests/fixtures/learn/pack";
import { buildConceptSets, buildSearchIndex } from "./indexes";
import { parsePack } from "./validate";

const parsed = (mutate?: (p: any) => void) => {
  const raw = makePack();
  mutate?.(raw);
  const r = parsePack(raw);
  expect(r.ok, JSON.stringify(r.issues)).toBe(true);
  return r.pack!;
};

describe("buildSearchIndex", () => {
  it("emits entries with exactly id,type,title,summary,tags,url", () => {
    const idx = buildSearchIndex(parsed(), "system-design");
    expect(idx.length).toBeGreaterThan(0);
    for (const e of idx) {
      expect(Object.keys(e).sort()).toEqual(["id", "summary", "tags", "title", "type", "url"]);
      expect(e.url.startsWith("/learn/system-design")).toBe(true);
    }
    expect(idx.find((e) => e.id === "caching")).toMatchObject({
      type: "concept",
      url: "/learn/system-design/concepts/caching",
    });
    expect(idx.find((e) => e.id === "url-shortener")).toMatchObject({
      type: "problem",
      url: "/learn/system-design/problems/url-shortener",
    });
    expect(idx.some((e) => e.type === "question")).toBe(true);
  });
  it("covers only approved items (proposed question excluded)", () => {
    const idx = buildSearchIndex(parsed(), "system-design");
    expect(idx.some((e) => e.id === "q-caching-5")).toBe(false);
  });
  it("serialised index stays under 20 KB for the fixtures plus 40 extra questions", () => {
    const idx = buildSearchIndex(parsed((p) => addGrounded(p, 40)), "system-design");
    expect(Buffer.byteLength(JSON.stringify(idx))).toBeLessThan(20 * 1024);
  });
});

describe("buildConceptSets", () => {
  it("unions owner questions and relatedConceptIds, approved only", () => {
    const sets = buildConceptSets(parsed());
    const caching = sets.find((s) => s.id === "set-caching")!;
    expect(caching).toBeDefined();
    expect(caching.conceptId).toBe("caching");
    // owner questions + the problem question that lists caching in relatedConceptIds
    expect([...caching.questionIds].sort()).toEqual(
      ["q-caching-1", "q-caching-2", "q-caching-3", "q-caching-4", "q-url-shortener-1"].sort(),
    );
    expect(caching.questionIds).not.toContain("q-caching-5"); // proposed
  });
  it("does not duplicate a question that is both owner and related", () => {
    const sets = buildConceptSets(parsed((p) => (p.questions[0].relatedConceptIds = ["caching"])));
    const ids = sets.find((s) => s.id === "set-caching")!.questionIds;
    expect(new Set(ids).size).toBe(ids.length);
  });
});
