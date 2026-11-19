// T-087 / ADR-0016: roadmap components use token utilities only, and every node state meets contrast against the v2 tokens.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.ts";

const css = readFileSync(join(REPO, "apps/web/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no block ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const v2 = { ...block(":root"), ...block(':root:not(.dark) [data-ui="v2"]') };
function resolve(name: string): string {
  const v = v2[name];
  if (v === undefined) throw new Error(`missing ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(ref[1]!) : v;
}
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(resolve(a)), lum(resolve(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// [state, foreground token, background token] mirroring the classes in TopicNode, RoadmapList and TopicPanel.
const borders: [string, string, string][] = [
  ["new node border", "--input", "--card"],
  ["hover border", "--primary", "--card"],
  ["focus ring on canvas", "--ring", "--background"],
  ["selected border on blaze", "--primary", "--highlight"],
  ["covered border on covered fill", "--route", "--known"],
  ["start-here chip border", "--primary", "--card"],
  ["start node border", "--foreground", "--card"],
  ["start pill border", "--foreground", "--card"],
  ["default edge and arrowhead", "--edge-unmet", "--background"],
  ["covered edge and arrowhead", "--route", "--background"],
  ["active edge and arrowhead", "--foreground", "--background"],
  ["chevron affordance", "--muted-foreground", "--card"],
  ["paid chip border", "--input", "--card"],
  ["panel chip border", "--input", "--card"],
];
const texts: [string, string, string][] = [
  ["new node text", "--foreground", "--card"],
  ["start pill text", "--foreground", "--card"],
  ["goal pill text", "--primary-foreground", "--primary"],
  ["selected node text", "--highlight-foreground", "--highlight"],
  ["covered node text", "--known-foreground", "--known"],
  ["free chip text", "--known-foreground", "--known"],
  ["paid chip text", "--foreground", "--card"],
  ["muted text on panel", "--muted-foreground", "--card"],
  ["muted text on canvas", "--muted-foreground", "--background"],
  ["lane header text", "--foreground", "--background"],
  ["known lane header text", "--route", "--background"],
];

describe("roadmap node states (v2 tokens)", () => {
  it.each(borders)("%s >= 3:1", (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
  it.each(texts)("%s >= 4.5:1", (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it("states are distinct (new vs covered vs selected fills)", () => {
    const fills = ["--card", "--known", "--highlight"].map(resolve);
    expect(new Set(fills).size).toBe(3);
  });
});

describe("roadmap components use tokens only", () => {
  const dir = join(REPO, "apps/web/components/roadmap");
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/contour-tile/.test(f));
  const patterns: [string, RegExp][] = [
    ["hex colour", /#[0-9a-fA-F]{3,8}\b/],
    ["radius px literal", /rounded(-[a-z]+)?-\[\d+(\.\d+)?px\]/],
    ["duration literal", /duration-\[?\d+(ms|s)?\]?|\d+ms\b/],
    ["bark literal", /--bark/],
  ];
  it.each(files)("%s has no hex, radius px or duration literal", (f) => {
    const src = readFileSync(join(dir, f), "utf8");
    for (const [name, re] of patterns) expect(src.match(re), `${f}: ${name}`).toBeNull();
  });
});
