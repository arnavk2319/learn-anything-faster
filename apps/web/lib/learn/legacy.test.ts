import { describe, expect, it } from "vitest";
import { upgradeLegacy } from "./legacy";

describe("upgradeLegacy", () => {
  it("maps sim:{ref} blocks and block-level faq src, counting each", () => {
    let n = 0;
    const out = upgradeLegacy(
      [
        { type: "sim", id: "s", sim: { ref: "x" } },
        { type: "faq", id: "f", src: { kind: "gap" }, items: [{ q: "q", a: "a" }] },
      ],
      () => n++,
    );
    expect(out).toEqual([
      { type: "sim", id: "s", ref: "x" },
      { type: "faq", id: "f", items: [{ src: { kind: "gap" }, q: "q", a: "a" }] },
    ]);
    expect(n).toBe(2);
  });
});
