// T-024: token parity, contrast and "no literals in components" checks. Contrast is computed from the CSS, not by eye.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../../..");
const theme = readFileSync(join(root, "design/theme.css"), "utf8");
const globals = readFileSync(join(root, "apps/web/app/globals.css"), "utf8");

function block(css: string, selector: string): Record<string, string> {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const start = plain.indexOf(`${selector} {`);
  const body = plain.slice(plain.indexOf("{", start) + 1, plain.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const light = block(theme, ":root");
const dark = { ...light, ...block(theme, ".dark") };

type RGB = [number, number, number];
function resolve(vars: Record<string, string>, name: string): string {
  let v = vars[name];
  if (v === undefined) throw new Error(`missing ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) v = resolve(vars, ref[1]!);
  return v;
}
const hex = (h: string): RGB => {
  const m = /^#([0-9a-f]{6})$/i.exec(h);
  if (!m) throw new Error(`not hex: ${h}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const color = (vars: Record<string, string>, name: string) => hex(resolve(vars, name));
const lum = ([r, g, b]: RGB) => {
  const c = [r, g, b].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
// --lane-band is color-mix(in srgb, var(--X) N%, transparent): composite X at N% over a backdrop.
function band(vars: Record<string, string>, over: RGB): RGB {
  const m = /color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, transparent\)/.exec(
    vars["--lane-band"]!,
  );
  if (!m) throw new Error("lane-band format");
  const base = color(vars, m[1]!);
  const a = Number(m[2]) / 100;
  return base.map((c, i) => Math.round(c * a + over[i]! * (1 - a))) as RGB;
}

describe("graph tokens (T-024)", () => {
  it("keeps design/theme.css and app/globals.css identical", () => {
    expect(globals).toBe(theme);
  });

  it("defines the new tokens, utilities and classes", () => {
    for (const t of ["--contour", "--canvas", "--lane-band", "--edge-unmet", "--draw-dur"]) {
      expect(light[t], t).toBeDefined();
    }
    for (const t of ["--contour", "--canvas", "--lane-band", "--edge-unmet"]) {
      expect(block(theme, ".dark")[t], `dark ${t}`).toBeDefined();
    }
    for (const c of [
      "--color-contour",
      "--color-canvas",
      "--color-lane-band",
      "--color-edge-unmet",
    ]) {
      expect(theme).toContain(c);
    }
    for (const c of [".canvas-contour {", "path.edge-unmet {", ".edge-hot {", ".canvas-dots {"]) {
      expect(theme).toContain(c);
    }
  });

  for (const [mode, vars] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    describe(mode, () => {
      const canvas = color(vars, "--canvas");
      it("contour is decorative: below 1.3:1 against the canvas", () => {
        expect(ratio(color(vars, "--contour"), canvas)).toBeLessThan(1.3);
      });
      it("text on the lane band stays at least 8:1, even over a contour line", () => {
        const text = color(vars, "--foreground");
        expect(ratio(text, band(vars, canvas))).toBeGreaterThanOrEqual(8);
        expect(ratio(text, band(vars, color(vars, "--contour")))).toBeGreaterThanOrEqual(8);
      });
      it("unmet edge is at least 3:1 and the hot route edge 4.5:1 against the canvas", () => {
        expect(ratio(color(vars, "--edge-unmet"), canvas)).toBeGreaterThanOrEqual(3);
        expect(ratio(color(vars, "--route"), canvas)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it("components/roadmap has no hex colours, ms durations or px radii", () => {
    const dir = join(__dirname, "../../components/roadmap");
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && !n.includes(".test."))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, `${f} hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, `${f} ms`).not.toMatch(/\b\d+ms\b/);
      expect(src, `${f} radius`).not.toMatch(/rounded-\[\d+px\]/);
    }
  });
});
