// T-077 / ADR-0016: token parity, v2/compact scoping, contrast tables recomputed from the token file, no literals in components.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.ts";

const theme = readFileSync(join(REPO, "design/theme.css"), "utf8");
const globals = readFileSync(join(REPO, "apps/web/app/globals.css"), "utf8");
const plain = theme.replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): Record<string, string> {
  const start = plain.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no block ${selector}`);
  const body = plain.slice(plain.indexOf("{", start) + 1, plain.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const root = block(":root");
const v2 = { ...root, ...block(':root:not(.dark) [data-ui="v2"]') };
const compact = block('[data-density="compact"]');

function resolve(vars: Record<string, string>, name: string): string {
  const v = vars[name];
  if (v === undefined) throw new Error(`missing ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(vars, ref[1]!) : v;
}
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(resolve(v2, a)), lum(resolve(v2, b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("token files", () => {
  it("globals.css and design/theme.css are identical", () => {
    expect(globals).toBe(theme);
  });

  it("v2 palette matches ADR-0016", () => {
    expect(v2["--background"]).toBe("#f6f3ea");
    expect(v2["--muted"]).toBe("#eef2e6");
    expect(v2["--border"]).toBe("#ddd8c6");
    expect(v2["--border-firm"]).toBe("#c4bea6");
    expect(root["--border-firm"]).toBe("var(--border)");
    expect(root["--background"]).toBe("var(--sage)");
  });

  it("focus ring token is unchanged", () => {
    expect(v2["--ring"]).toBe("var(--trail)");
    expect(resolve(v2, "--ring")).toBe("#1f6f50");
  });

  it("compact tier values", () => {
    expect(compact["--text-body"]).toBe("14px");
    expect(compact["--text-ui"]).toBe("13px");
    expect(compact["--text-h1"]).toBe("clamp(24px, 2.2vw, 28px)");
    expect(compact["--text-h2"]).toBe("clamp(17px, 1.6vw, 20px)");
    expect([
      compact["--control-h-sm"],
      compact["--control-h-md"],
      compact["--control-h-lg"],
    ]).toEqual(["28px", "32px", "36px"]);
    expect(compact["--hit-min"]).toBe("44px");
    expect(root["--text-body"]).toBe("16px");
  });

  it("motion tokens exist in :root and reduced motion zeroes them", () => {
    for (const t of [
      "--dur-press",
      "--dur-lift",
      "--dur-spring",
      "--ease-spring",
      "--press-y",
      "--press-scale",
      "--lift-y",
      "--burst-dur",
    ])
      expect(root[t], t).toBeDefined();
    expect(plain).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*:root \{[^}]*--press-y: 0px;[^}]*--dur-lift: 0ms/,
    );
  });

  it("v2 and compact are not scoped to :root alone", () => {
    expect(plain).not.toMatch(/:root\s*\{[^}]*--background: #f6f3ea/);
  });
});

describe("contrast (WCAG 2.1, recomputed from tokens)", () => {
  const text: [string, string, number][] = [
    ["--foreground", "--background", 11.06],
    ["--foreground", "--card", 12.27],
    ["--foreground", "--muted", 10.8],
    ["--foreground", "--known", 9.93],
    ["--foreground", "--highlight", 7.32],
    ["--primary-foreground", "--primary", 12.27],
    ["--muted-foreground", "--background", 5.69],
    ["--muted-foreground", "--card", 6.31],
    ["--muted-foreground", "--muted", 5.55],
    ["--route", "--background", 5.49],
    ["--route", "--card", 6.09],
    ["--route", "--muted", 5.36],
    ["--route", "--known", 4.93],
    ["--card", "--route", 6.09],
    ["--destructive", "--background", 6.03],
    ["--destructive", "--card", 6.69],
  ];
  it.each(text)("text %s on %s >= 4.5 and equals ADR %s", (fg, bg, adr) => {
    const r = ratio(fg, bg);
    expect(r).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(r - adr)).toBeLessThan(0.011);
  });

  const control: [string, string, number][] = [
    ["--input", "--card", 3.63],
    ["--input", "--background", 3.27],
    ["--input", "--muted", 3.19],
    ["--ring", "--background", 5.49],
    ["--ring", "--card", 6.09],
  ];
  it.each(control)("control border %s on %s >= 3 and equals ADR %s", (fg, bg, adr) => {
    const r = ratio(fg, bg);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(Math.abs(r - adr)).toBeLessThan(0.011);
  });

  const decorative: [string, string, number][] = [
    ["--border-firm", "--card", 1.86],
    ["--border-firm", "--background", 1.68],
    ["--border", "--card", 1.43],
    ["--border", "--background", 1.29],
    ["--highlight", "--background", 1.51],
    ["--highlight", "--card", 1.68], // ADR-0016 rounds this to 1.70; measured is 1.68
  ];
  it.each(decorative)("decorative %s on %s equals ADR %s (exempt from 3:1)", (fg, bg, adr) => {
    expect(Math.abs(ratio(fg, bg) - adr)).toBeLessThan(0.011);
  });
});

describe("no literals in components", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (e === "node_modules" || e === ".next") continue;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(tsx?|css)$/.test(e) && !/\.test\./.test(e) && !/globals\.css$/.test(e))
        out.push(p);
    }
    return out;
  }
  const files = [...walk(join(REPO, "apps/web/components")), ...walk(join(REPO, "apps/web/app"))];
  const NEW =
    /#(f6f3ea|eef2e6|ddd8c6|c4bea6)\b|--(dur-(press|lift|spring)|burst-dur):\s*\d|cubic-bezier\(0\.34/i;
  it("v2 palette hex, new durations and spring easing appear only in token files", () => {
    const hits = files.filter((f) => NEW.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
