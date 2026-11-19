import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packages/graph stays pure", () => {
  it("suggest-start imports no react, drizzle, xyflow or DOM globals", () => {
    const src = readFileSync("packages/graph/src/suggest-start.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'](react|drizzle|@xyflow)|document\.|window\./);
  });
});
