import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLayouts, OUT } from "./generate-layouts";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("generated sim layouts", () => {
  it("generated/layouts.json is current (run pnpm learn:layout when templates change)", async () => {
    expect(JSON.parse(readFileSync(OUT, "utf8"))).toEqual(await buildLayouts());
  });
  it("client code never imports elkjs or @xyflow (ELK is build-time only)", () => {
    const dirs = [__dirname, join(__dirname, "../../../components/learn")];
    for (const dir of dirs)
      for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x) && x !== "generate-layouts.ts")) {
        const src = strip(readFileSync(join(dir, f), "utf8"));
        expect(src, f).not.toMatch(/@xyflow|elk-worker|from\s+["']elkjs/);
        if (f !== "layouts.test.ts") expect(src, f).not.toMatch(/\bnew Worker\b/);
      }
  });
});
