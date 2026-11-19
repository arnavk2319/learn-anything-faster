// T-090: the build-time narrow (vertical) layout and the mode picker.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLayouts,
  buildNarrowLayouts,
  OUT,
  OUT_NARROW,
  serialize,
  templateSims,
} from "./generate-layouts";
import { fallbackNarrowLayout, getNarrowLayout, NARROW_MAX, pickMode } from "./layout";

const narrow = JSON.parse(readFileSync(OUT_NARROW, "utf8")) as Awaited<
  ReturnType<typeof buildNarrowLayouts>
>;

describe("generated layouts are a no-op to regenerate", () => {
  it("layouts.json and layouts-narrow.json match buildLayouts output byte for byte", async () => {
    expect(readFileSync(OUT, "utf8")).toBe(serialize(await buildLayouts()));
    expect(readFileSync(OUT_NARROW, "utf8")).toBe(serialize(await buildNarrowLayouts()));
  });
  it("every template sim has an entry in both files, sorted by sim id", () => {
    const wide = JSON.parse(readFileSync(OUT, "utf8")) as Record<string, unknown>;
    const ids = templateSims()
      .map((s) => s.id)
      .sort();
    expect(Object.keys(wide)).toEqual(ids);
    expect(Object.keys(narrow)).toEqual(ids);
  });
});

describe("narrow layout geometry", () => {
  for (const sim of templateSims()) {
    it(`${sim.id}: nodes inside the viewBox, no overlaps, routes end on nodes`, () => {
      const l = narrow[sim.id];
      expect(l).toBeDefined();
      if (!l) return;
      const boxes = sim.nodes.map((n) => ({ id: n.id, ...l.nodes[n.id]! }));
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(l.width);
        expect(b.y + b.h).toBeLessThanOrEqual(l.height);
      }
      for (const a of boxes)
        for (const b of boxes)
          if (a.id < b.id)
            expect(
              a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
              `${a.id} overlaps ${b.id}`,
            ).toBe(true);
      const on = (p: { x: number; y: number }, id: string) => {
        const b = l.nodes[id]!;
        const e = 1;
        return p.x >= b.x - e && p.x <= b.x + b.w + e && p.y >= b.y - e && p.y <= b.y + b.h + e;
      };
      for (const e of sim.edges) {
        const r = l.edges[e.id]!;
        expect(r.length).toBeGreaterThanOrEqual(2);
        expect(on(r[0]!, e.from), `${e.id} start`).toBe(true);
        expect(on(r[r.length - 1]!, e.to), `${e.id} end`).toBe(true);
      }
    });
    it(`${sim.id}: narrow layout is a single column no wider than 280`, () => {
      expect(narrow[sim.id]!.width).toBeLessThanOrEqual(280);
    });
  }
  it("getNarrowLayout serves the generated layout, and the fallback is valid for any sim", () => {
    for (const sim of templateSims()) {
      expect(getNarrowLayout(sim)).toEqual(narrow[sim.id]);
      const f = fallbackNarrowLayout(sim);
      expect(Object.keys(f.nodes).sort()).toEqual(sim.nodes.map((n) => n.id).sort());
      for (const e of sim.edges) expect(f.edges[e.id]!.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("mode picker", () => {
  it("is narrow at or below 480 and wide above", () => {
    expect(NARROW_MAX).toBe(480);
    expect(pickMode(226)).toBe("narrow");
    expect(pickMode(480)).toBe("narrow");
    expect(pickMode(481)).toBe("wide");
    expect(pickMode(1000)).toBe("wide");
  });
  it("is wide when there is no measurement", () => {
    expect(pickMode(null)).toBe("wide");
    expect(pickMode(undefined)).toBe("wide");
    expect(pickMode(0)).toBe("wide");
  });
});
