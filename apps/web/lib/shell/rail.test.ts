import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRACTION,
  UI_STORAGE_KEY,
  clampFraction,
  clampWidth,
  fractionFromWidth,
  railBounds,
  railReducer,
  readUiPrefs,
  widthFromFraction,
  writeUiPrefs,
  type StorageLike,
} from "./rail";

const m = { label: 500, chrome: 50 };
const b = railBounds(m); // min 450, max 550

function mem(initial?: string): StorageLike & { v: string | null } {
  const s = {
    v: initial ?? null,
    getItem: () => s.v,
    setItem: (_k: string, val: string) => {
      s.v = val;
    },
  };
  return s;
}

describe("railBounds", () => {
  it("min shows 80% of the label, max shows all of it", () => {
    expect(b).toEqual({ min: 450, max: 550 });
    expect(railBounds({ label: 333.3, chrome: 10.2 })).toEqual({ min: 277, max: 344 });
  });
});

describe("railReducer", () => {
  it("steps 8px and 32px with shift, clamped", () => {
    expect(railReducer(500, { type: "step", dir: 1 }, b)).toBe(508);
    expect(railReducer(500, { type: "step", dir: -1 }, b)).toBe(492);
    expect(railReducer(500, { type: "step", dir: -1, shift: true }, b)).toBe(468);
    expect(railReducer(545, { type: "step", dir: 1 }, b)).toBe(550);
    expect(railReducer(455, { type: "step", dir: -1, shift: true }, b)).toBe(450);
  });
  it("home/end jump to min/max; set clamps", () => {
    expect(railReducer(500, { type: "min" }, b)).toBe(450);
    expect(railReducer(500, { type: "max" }, b)).toBe(550);
    expect(railReducer(500, { type: "set", width: 10 }, b)).toBe(450);
    expect(railReducer(500, { type: "set", width: 9999 }, b)).toBe(550);
    expect(clampWidth(Number.NaN, b)).toBe(550);
  });
});

describe("fractions", () => {
  it("clamps to [0.8, 1] and falls back to 1 for non-numbers", () => {
    expect(clampFraction(0.5)).toBe(0.8);
    expect(clampFraction(7)).toBe(1);
    expect(clampFraction(0.9)).toBe(0.9);
    for (const bad of ["x", null, undefined, Number.NaN, Infinity, {}]) {
      expect(clampFraction(bad)).toBe(DEFAULT_FRACTION);
    }
  });
  it("round-trips width and fraction", () => {
    expect(widthFromFraction(1, m)).toBe(550);
    expect(widthFromFraction(0.8, m)).toBe(450);
    expect(widthFromFraction(0.9, m)).toBe(500);
    expect(fractionFromWidth(500, m)).toBeCloseTo(0.9);
    expect(fractionFromWidth(10, m)).toBe(0.8);
    expect(fractionFromWidth(500, { label: 0, chrome: 0 })).toBe(1);
  });
});

describe("prefs storage", () => {
  it("defaults when empty, corrupt, wrong version or no storage", () => {
    const d = { rail: 1, rightCollapsed: false };
    expect(readUiPrefs(null)).toEqual(d);
    expect(readUiPrefs(mem())).toEqual(d);
    expect(readUiPrefs(mem("{not json"))).toEqual(d);
    expect(readUiPrefs(mem('{"v":2,"rail":0.9}'))).toEqual(d);
    expect(readUiPrefs(mem('"x"'))).toEqual(d);
    expect(readUiPrefs(mem('{"v":1,"rail":"wide","rightCollapsed":"yes"}'))).toEqual(d);
  });
  it("clamps a stored out-of-range fraction", () => {
    expect(readUiPrefs(mem('{"v":1,"rail":0.1}')).rail).toBe(0.8);
    expect(readUiPrefs(mem('{"v":1,"rail":3}')).rail).toBe(1);
    expect(readUiPrefs(mem('{"v":1,"rail":0.85,"rightCollapsed":true}'))).toEqual({
      rail: 0.85,
      rightCollapsed: true,
    });
  });
  it("write merges, keeps foreign keys and versions the record", () => {
    const s = mem('{"v":1,"celebrations":false}');
    writeUiPrefs({ rail: 0.9 }, s);
    writeUiPrefs({ rightCollapsed: true }, s);
    expect(JSON.parse(s.v ?? "")).toEqual({
      v: 1,
      celebrations: false,
      rail: 0.9,
      rightCollapsed: true,
    });
    expect(UI_STORAGE_KEY).toBe("laf:ui:v1");
  });
  it("write over corrupt data starts fresh and never throws", () => {
    const s = mem("garbage");
    writeUiPrefs({ rail: 0.9 }, s);
    expect(JSON.parse(s.v ?? "")).toEqual({ v: 1, rail: 0.9 });
    expect(() => writeUiPrefs({ rail: 1 }, null)).not.toThrow();
  });
});
