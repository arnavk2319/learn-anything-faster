import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionSchema } from "@/lib/learn/schemas";
import { toGrading, toPublic } from "@/lib/learn/quickcheck";
import { makePack } from "../../../../tests/fixtures/learn/pack";
import { HintText } from "./HintText";

const html = (type: "mcq" | "multi", hint?: string) =>
  renderToStaticMarkup(createElement(HintText, { type, hint }));

describe("HintText", () => {
  it("shows the authored hint when present", () => {
    expect(html("mcq", "Think about keys never stored.")).toContain(
      "Think about keys never stored.",
    );
  });
  it("falls back to the generic text when absent", () => {
    expect(html("mcq")).toContain("Reread the section above, then look at each option again.");
    expect(html("multi")).toContain("More than one option can apply.");
  });
  it("renders hint text as text, not HTML", () => {
    const out = html("mcq", "use <b>bold</b> &lt;i&gt;");
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(out).toContain("&amp;lt;i&amp;gt;");
  });
});

describe("hint delivery shape", () => {
  const q = QuestionSchema.parse({ ...makePack().questions[0], hint: "A nudge." });
  it("is in the grading entry, never in the public question", () => {
    expect(toGrading(q).hint).toBe("A nudge.");
    expect(JSON.stringify(toPublic(q))).not.toContain("A nudge.");
  });
  it("is omitted from grading when the question has none", () => {
    expect("hint" in toGrading(QuestionSchema.parse(makePack().questions[0]))).toBe(false);
  });
});
