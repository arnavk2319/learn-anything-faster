import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url).pathname;

describe("learn:validate wiring (T-039)", () => {
  it("package.json defines learn:validate and verify runs it", () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
    expect(pkg.scripts["learn:validate"]).toMatch(/learn-validate/);
    const verify = readFileSync(`${root}scripts/verify.ts`, "utf8");
    expect(verify).toMatch(/learn:validate/);
  });
  it("passes on the committed content/learn tree and prints the gap ratio", () => {
    const out = execFileSync("pnpm", ["-s", "learn:validate"], { cwd: root, encoding: "utf8" });
    expect(out).toMatch(/gap/i);
  });
});
