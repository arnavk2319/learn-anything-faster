import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// T-078: primitives use token utilities only (no hex, px radius or ms literals).
const dir = new URL(".", import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(tsx|ts)$/.test(f) && !f.endsWith(".test.ts"));

describe("ui primitives use tokens only", () => {
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), "utf8");
    it(`${f}: no hex colours`, () => expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/));
    it(`${f}: no px radius`, () => expect(src).not.toMatch(/rounded-\[[^\]]*px/));
    it(`${f}: no ms literals`, () => expect(src).not.toMatch(/\b\d+ms\b|duration-\d+|duration-\[/));
  }
});
