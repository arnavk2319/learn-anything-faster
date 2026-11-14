import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const src = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("sim engine boundaries", () => {
  it("has source files (engine.ts, templates.ts)", () => {
    expect(files).toEqual(expect.arrayContaining(["engine.ts", "templates.ts"]));
  });
  it("uses no clock, randomness or timers", () => {
    const banned = /\b(Date|Math\.random|setTimeout|setInterval|requestAnimationFrame|performance\.now|crypto\.randomUUID)\b/;
    for (const f of files) expect(src(f), f).not.toMatch(banned);
  });
  it("imports no React, Next, DB or browser/server-only modules", () => {
    const banned = /from\s+["'](react|react-dom|next|next\/[^"']*|@xyflow\/[^"']*|drizzle-orm[^"']*|pg|postgres|@neondatabase\/[^"']*|@\/db[^"']*|node:fs|fs)["']/;
    for (const f of files) expect(src(f), f).not.toMatch(banned);
  });
  it("does not touch window or document", () => {
    for (const f of files) expect(src(f), f).not.toMatch(/\b(window|document|localStorage)\b/);
  });
});
