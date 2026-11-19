// T-098: collapse flags beside the existing rail prefs (ADR-0016 amendment 1). Same envelope, version stays 1.
import { describe, expect, it } from "vitest";
import { readExtraPrefs, readUiPrefs, writeUiPrefs, type StorageLike } from "./rail";

function mem(init?: string): StorageLike & { v: string | null } {
  const o = {
    v: init ?? null,
    getItem: () => o.v,
    setItem: (_k: string, val: string) => {
      o.v = val;
    },
  };
  return o;
}

describe("readExtraPrefs", () => {
  const d = { leftCollapsed: false, graphHintDismissed: false };
  it("defaults when missing, corrupt, wrong version or null storage", () => {
    expect(readExtraPrefs(mem())).toEqual(d);
    expect(readExtraPrefs(mem("{corrupt"))).toEqual(d);
    expect(readExtraPrefs(mem('{"v":2,"leftCollapsed":true}'))).toEqual(d);
    expect(readExtraPrefs(null)).toEqual(d);
  });
  it("ignores non-boolean values", () => {
    expect(readExtraPrefs(mem('{"v":1,"leftCollapsed":"yes","graphHintDismissed":1}'))).toEqual(d);
  });
  it("reads booleans", () => {
    expect(readExtraPrefs(mem('{"v":1,"leftCollapsed":true,"graphHintDismissed":true}'))).toEqual({
      leftCollapsed: true,
      graphHintDismissed: true,
    });
  });
});

describe("writeUiPrefs with the extra flags", () => {
  it("merges without a version bump and keeps other keys", () => {
    const s = mem('{"v":1,"rail":0.9,"rightCollapsed":true,"celebrations":false}');
    writeUiPrefs({ leftCollapsed: true }, s);
    writeUiPrefs({ graphHintDismissed: true }, s);
    expect(JSON.parse(s.v ?? "")).toEqual({
      v: 1,
      rail: 0.9,
      rightCollapsed: true,
      celebrations: false,
      leftCollapsed: true,
      graphHintDismissed: true,
    });
    expect(readUiPrefs(s)).toEqual({ rail: 0.9, rightCollapsed: true });
  });
});
