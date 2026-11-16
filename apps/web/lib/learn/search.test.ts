import { describe, expect, it } from "vitest";
import { searchDocs, scoreDoc, tokenize, type SearchDoc } from "./search";

const doc = (o: Partial<SearchDoc> & { id: string }): SearchDoc => ({
  type: "concept",
  title: o.id,
  summary: "",
  tags: [],
  url: `/learn/x/${o.id}`,
  ...o,
});

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumerics", () => {
    expect(tokenize("Load-Balancing, v2!")).toEqual(["load", "balancing", "v2"]);
  });
});

describe("search scoring", () => {
  const docs = [
    doc({ id: "a", title: "Caching", summary: "Keep hot data close" }),
    doc({ id: "b", title: "Replication", summary: "Copies data; a cache can help reads" }),
    doc({ id: "c", title: "Queues", tags: ["cache"], summary: "Decouple work" }),
  ];

  it("matches by prefix", () => {
    expect(searchDocs(docs, "cach").map((d) => d.id)).toContain("a");
    expect(searchDocs(docs, "repl").map((d) => d.id)).toEqual(["b"]);
  });

  it("weights title over tags over summary", () => {
    const r = searchDocs(docs, "cach").map((d) => d.id);
    // a: title prefix = 6; c: tag prefix = 3; b: summary prefix = 1
    expect(r).toEqual(["a", "c", "b"]);
  });

  it("an exact word beats a prefix in the same field", () => {
    const a = scoreDoc(doc({ id: "x", title: "Cache" }), ["cache"]);
    const b = scoreDoc(doc({ id: "y", title: "Caching" }), ["cache"]);
    expect(a).toBeGreaterThan(b);
  });

  it("requires every token to match and ignores empty queries", () => {
    expect(searchDocs(docs, "cache reads").map((d) => d.id)).toEqual(["b"]);
    expect(searchDocs(docs, "cache zebra")).toEqual([]);
    expect(searchDocs(docs, "   ")).toEqual([]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => doc({ id: `n${i}`, title: "Node" }));
    expect(searchDocs(many, "no", 5)).toHaveLength(5);
  });
});
