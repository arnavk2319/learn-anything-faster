import { describe, expect, it } from "vitest";
import { filterRoles, nextActiveIndex, optionLabel, type RoleOption } from "./filter-roles.ts";

const opts: RoleOption[] = [
  { id: "mlops", name: "MLOps engineer", status: "soon" },
  { id: "ml", name: "ML engineer", status: "available" },
  { id: "fs", name: "Full-stack engineer", status: "available" },
];

describe("filterRoles", () => {
  it("returns all, Available now first then Coming soon", () => {
    const r = filterRoles(opts, "");
    expect(r.groups.map((g) => g.label)).toEqual(["Available now", "Coming soon"]);
    expect(r.flat.map((o) => o.id)).toEqual(["ml", "fs", "mlops"]);
    expect(r.empty).toBe(false);
  });
  it("is a case-insensitive substring match", () => {
    expect(filterRoles(opts, "ML E").flat.map((o) => o.id)).toEqual(["ml"]);
    expect(filterRoles(opts, "ml e").flat.map((o) => o.id)).toEqual(["ml"]);
  });
  it("omits empty groups", () => {
    expect(filterRoles(opts, "mlops").groups.map((g) => g.key)).toEqual(["soon"]);
  });
  it("flags empty results", () => {
    const r = filterRoles(opts, "zzz");
    expect(r.empty).toBe(true);
    expect(r.groups).toEqual([]);
  });
});

describe("nextActiveIndex", () => {
  it("wraps down and up", () => {
    expect(nextActiveIndex(2, 3, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(0, 3, "ArrowUp")).toBe(2);
    expect(nextActiveIndex(0, 3, "ArrowDown")).toBe(1);
    expect(nextActiveIndex(2, 3, "ArrowUp")).toBe(1);
  });
  it("starts from none", () => {
    expect(nextActiveIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(nextActiveIndex(-1, 3, "ArrowUp")).toBe(2);
  });
  it("Home and End jump", () => {
    expect(nextActiveIndex(1, 3, "Home")).toBe(0);
    expect(nextActiveIndex(1, 3, "End")).toBe(2);
  });
  it("returns -1 when there are no options", () => {
    expect(nextActiveIndex(0, 0, "ArrowDown")).toBe(-1);
  });
});

describe("optionLabel", () => {
  it("puts status in the name", () => {
    expect(optionLabel(opts[0]!, false)).toBe("MLOps engineer, coming soon, get notified");
    expect(optionLabel(opts[1]!, true)).toBe("ML engineer, selected");
  });
});
