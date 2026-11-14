import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("learn markdown subset", () => {
  it("parses inline code, bold and italic", () => {
    expect(parseInline("a `b` **c** *d*")).toEqual([
      { t: "text", v: "a " },
      { t: "code", v: "b" },
      { t: "text", v: " " },
      { t: "strong", v: [{ t: "text", v: "c" }] },
      { t: "text", v: " " },
      { t: "em", v: [{ t: "text", v: "d" }] },
    ]);
  });
  it("keeps raw HTML as literal text, never as markup", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([
      { t: "text", v: "<img src=x onerror=alert(1)>" },
    ]);
  });
  it("splits paragraphs and lists", () => {
    const md = parseMarkdown("one\ntwo\n\n- a\n- b\n\n1. x\n2. y");
    expect(md.map((b) => b.t)).toEqual(["p", "ul", "ol"]);
    expect(md[1]).toMatchObject({ v: [[{ t: "text", v: "a" }], [{ t: "text", v: "b" }]] });
  });
});
