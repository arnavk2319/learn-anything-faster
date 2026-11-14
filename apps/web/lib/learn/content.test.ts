import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Blocks } from "../../components/learn/Blocks";
import { ItemPage } from "../../components/learn/ItemPage";
import { listApprovedIds, loadTrack, ownerQuestions } from "./content";
import { toGrading } from "./quickcheck";
import { generateStaticParams as conceptParams } from "../../app/learn/[track]/concepts/[concept]/page";
import { generateStaticParams as problemParams } from "../../app/learn/[track]/problems/[problem]/page";
import {
  GET as quizGet,
  generateStaticParams as quizParams,
} from "../../app/learn/[track]/quiz/[owner]/route";

const FIXTURES = fileURLToPath(new URL("../../../../e2e/fixtures/learn", import.meta.url));
const prev = process.env.LEARN_CONTENT_DIR;
beforeAll(() => {
  process.env.LEARN_CONTENT_DIR = FIXTURES;
});
afterAll(() => {
  if (prev === undefined) delete process.env.LEARN_CONTENT_DIR;
  else process.env.LEARN_CONTENT_DIR = prev;
});

describe("learn content loader: proposed items are not built", () => {
  it("loads approved concepts only", () => {
    const pack = loadTrack("system-design");
    expect(pack?.concepts.map((c) => c.id)).toEqual(["caching"]);
    expect(pack?.problems.map((p) => p.id)).toEqual(["url-shortener"]);
  });
  it("static params exclude the proposed fixture concept", () => {
    expect(conceptParams()).toEqual([{ track: "system-design", concept: "caching" }]);
    expect(problemParams()).toEqual([{ track: "system-design", problem: "url-shortener" }]);
    expect(listApprovedIds().some((e) => e.id === "draft-topic")).toBe(false);
    expect(
      quizParams()
        .map((p) => p.owner)
        .sort(),
    ).toEqual(["caching", "url-shortener"]);
  });
  it("unknown and unsafe tracks resolve to null (404)", () => {
    expect(loadTrack("nope")).toBeNull();
    expect(loadTrack("../etc")).toBeNull();
  });
  it("the committed content never leaks a proposed item", () => {
    delete process.env.LEARN_CONTENT_DIR;
    try {
      for (const e of listApprovedIds()) {
        const pack = loadTrack(e.track);
        const items = e.kind === "concepts" ? pack?.concepts : pack?.problems;
        expect(items?.find((i) => i.id === e.id)?.status).toBe("approved");
      }
    } finally {
      process.env.LEARN_CONTENT_DIR = FIXTURES;
    }
  });
});

describe("block renderer", () => {
  const ctx = { sim: () => null, questions: () => [], gradingUrl: "/x" };
  const src = { kind: "gap", note: "test fixture block" } as const;
  it("renders code as a plain pre and escapes markup in text", () => {
    const html = renderToStaticMarkup(
      createElement(Blocks, {
        ctx,
        blocks: [
          { id: "c", type: "code", language: "sql", caption: "q", code: "SELECT <b>1</b>", src },
          { id: "t", type: "text", body: "<img src=x> **ok**", src },
          {
            id: "k",
            type: "compare",
            left: { title: "L", body: "- a" },
            right: { title: "R", body: "b" },
            src,
          },
        ],
      }),
    );
    expect(html).toContain("<pre");
    expect(html).toContain("SELECT &lt;b&gt;1&lt;/b&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("<strong>ok</strong>");
    expect(html).toContain("<li>a</li>");
  });
});

describe("rendered item pages", () => {
  const pack = () => loadTrack("system-design")!;
  it("concept page renders every block type with level anchors and no leaked answers", () => {
    const concept = pack().concepts[0]!;
    const html = renderToStaticMarkup(
      createElement(ItemPage, { pack: pack(), kind: "concept", item: concept }),
    );
    for (const id of ["basic", "intermediate", "advanced"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("<table");
    expect(html).toContain('data-tone="pitfall"');
    expect(html).toContain("<details");
    expect(html).toContain("<svg"); // sim poster
    expect(html).toContain('data-testid="question-card"');
    expect(html).not.toContain("<img");
    expect(html).toContain('href="/learn/system-design/problems/url-shortener"');
    // mcq answers and explanations travel only in the static JSON
    for (const q of ownerQuestions(pack(), "caching")) {
      expect(html).not.toContain(q.explanation);
    }
  });
  it("problem page links back to its concept", () => {
    const problem = pack().problems[0]!;
    const html = renderToStaticMarkup(
      createElement(ItemPage, { pack: pack(), kind: "problem", item: problem }),
    );
    expect(html).toContain('href="/learn/system-design/concepts/caching"');
  });
  it("grading JSON route returns approved answers and 404s an unknown track", async () => {
    const ok = await quizGet(new Request("http://x"), {
      params: Promise.resolve({ track: "system-design", owner: "caching" }),
    });
    const body = (await ok.json()) as ReturnType<typeof toGrading>[];
    expect(body.find((e) => e.id === "q-caching-4")?.answer).toBeTruthy();
    const miss = await quizGet(new Request("http://x"), {
      params: Promise.resolve({ track: "nope", owner: "caching" }),
    });
    expect(miss.status).toBe(404);
  });
});
