import { describe, expect, it } from "vitest";
import { makePack } from "../../../../tests/fixtures/learn/pack";
import {
  BlockSchema,
  ConceptSchema,
  ProblemSchema,
  QuestionSchema,
  QuestionSetSchema,
  SimSchema,
  TrackSchema,
} from "./schemas";

const p = () => makePack();

describe("learn schemas: good fixtures parse", () => {
  it("track, concept, problem, question, set, sim", () => {
    const pack = p();
    expect(TrackSchema.safeParse(pack.track).success).toBe(true);
    expect(ConceptSchema.safeParse(pack.concepts[0]).success).toBe(true);
    expect(ProblemSchema.safeParse(pack.problems[0]).success).toBe(true);
    for (const q of pack.questions) expect(QuestionSchema.safeParse(q).success).toBe(true);
    expect(QuestionSetSchema.safeParse(pack.sets[0]).success).toBe(true);
    expect(SimSchema.safeParse(pack.sims[0]).success).toBe(true);
  });
  it("every block type parses", () => {
    const src = { kind: "gap", note: "illustrative only" };
    const blocks = [
      { id: "b1", type: "text", body: "x", src },
      { id: "b2", type: "table", columns: ["a", "b"], rows: [["1", "2"]], src },
      { id: "b3", type: "compare", left: { title: "L", body: "- a" }, right: { title: "R", body: "- b" }, src },
      { id: "b4", type: "callout", tone: "pitfall", body: "x", src },
      { id: "b5", type: "code", language: "ts", caption: "c", code: "1", src },
      { id: "b6", type: "sim", ref: "some-sim", src },
      { id: "b7", type: "quiz", questionIds: ["q-a-1"], src },
      { id: "b8", type: "faq", items: [{ q: "q", a: "a", src }] },
    ];
    for (const b of blocks) expect(BlockSchema.safeParse(b).success, b.type).toBe(true);
  });
  it("concept accepts a sim exception instead of a sim", () => {
    const c = { ...p().concepts[0], sim: { exception: { reason: "abstract estimation topic" } } };
    expect(ConceptSchema.safeParse(c).success).toBe(true);
  });
});

describe("learn schemas: malformed fixtures fail readably", () => {
  const msg = (r: { success: boolean; error?: { message: string } }) => {
    expect(r.success).toBe(false);
    expect(r.error!.message.length).toBeGreaterThan(10);
  };
  it("track: summary over 200 chars, unknown key (strict), bad status", () => {
    msg(TrackSchema.safeParse({ ...p().track, summary: "x".repeat(201) }));
    msg(TrackSchema.safeParse({ ...p().track, extra: 1 }));
    msg(TrackSchema.safeParse({ ...p().track, status: "beta" }));
  });
  it("concept: bad stage, bad slug id, empty levels", () => {
    msg(ConceptSchema.safeParse({ ...p().concepts[0], stage: "expert" }));
    msg(ConceptSchema.safeParse({ ...p().concepts[0], id: "Not A Slug" }));
    msg(ConceptSchema.safeParse({ ...p().concepts[0], levels: {} }));
  });
  it("concept: quiz block with 3 ids or 0 ids", () => {
    const src = { kind: "gap", note: "illustrative only" };
    msg(BlockSchema.safeParse({ id: "b", type: "quiz", questionIds: ["q-a-1", "q-a-2", "q-a-3"], src }));
    msg(BlockSchema.safeParse({ id: "b", type: "quiz", questionIds: [], src }));
  });
  it("table: fewer than 2 columns, no rows", () => {
    const src = { kind: "gap", note: "illustrative only" };
    msg(BlockSchema.safeParse({ id: "b", type: "table", columns: ["a"], rows: [["1"]], src }));
    msg(BlockSchema.safeParse({ id: "b", type: "table", columns: ["a", "b"], rows: [], src }));
  });
  it("src: guide quote under 8 chars, gap note under 10 chars, unknown kind", () => {
    const block = (src: unknown) => ({ id: "b", type: "text", body: "x", src });
    msg(BlockSchema.safeParse(block({ kind: "guide", guide: "g", heading: "h", quote: "short" })));
    msg(BlockSchema.safeParse(block({ kind: "gap", note: "short" })));
    msg(BlockSchema.safeParse(block({ kind: "web", url: "https://x.y" })));
  });
  it("faq item without its own src fails", () => {
    msg(BlockSchema.safeParse({ id: "b", type: "faq", items: [{ q: "q", a: "a" }] }));
  });
  it("question: bad type, difficulty out of range, missing src", () => {
    const q = p().questions[0];
    msg(QuestionSchema.safeParse({ ...q, type: "essay" }));
    msg(QuestionSchema.safeParse({ ...q, difficulty: 6 }));
    msg(QuestionSchema.safeParse({ ...q, src: undefined }));
  });
  it("question: needs exactly one owner (both or neither fail)", () => {
    const q = p().questions[0];
    msg(QuestionSchema.safeParse({ ...q, problemId: "url-shortener" }));
    msg(QuestionSchema.safeParse({ ...q, conceptId: undefined }));
  });
  it("question set: kind enum and empty conceptIds", () => {
    msg(QuestionSetSchema.safeParse({ ...p().sets[0], kind: "weird" }));
    msg(QuestionSetSchema.safeParse({ ...p().sets[0], conceptIds: [] }));
  });
  it("sim: unknown node kind, empty scenarios", () => {
    const s = p().sims[0];
    msg(SimSchema.safeParse({ ...s, nodes: [{ ...s.nodes[0], kind: "spaceship" }] }));
    msg(SimSchema.safeParse({ ...s, scenarios: [] }));
  });
});
