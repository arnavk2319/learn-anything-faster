// Pure helpers for the role combobox (T-072). No React, no DOM.
export type RoleStatus = "available" | "soon";
export type RoleOption = { id: string; name: string; status: RoleStatus };

export type RoleGroup = { key: RoleStatus; label: string; options: RoleOption[] };

export type FilterResult = {
  groups: RoleGroup[];
  /** Options in display order (the keyboard order). */
  flat: RoleOption[];
  empty: boolean;
};

const GROUPS: { key: RoleStatus; label: string }[] = [
  { key: "available", label: "Available now" },
  { key: "soon", label: "Coming soon" },
];

/** Case-insensitive substring match on name; fixed group order; empty groups omitted. */
export function filterRoles(options: readonly RoleOption[], query: string): FilterResult {
  const q = query.trim().toLowerCase();
  const matched = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const groups = GROUPS.map((g) => ({
    ...g,
    options: matched.filter((o) => o.status === g.key),
  })).filter((g) => g.options.length > 0);
  const flat = groups.flatMap((g) => g.options);
  return { groups, flat, empty: flat.length === 0 };
}

export type NavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** Next active index (-1 = none). ArrowDown/ArrowUp wrap; Home/End jump. */
export function nextActiveIndex(current: number, count: number, key: NavKey): number {
  if (count <= 0) return -1;
  switch (key) {
    case "ArrowDown":
      return current < 0 || current >= count - 1 ? 0 : current + 1;
    case "ArrowUp":
      return current <= 0 ? count - 1 : current - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}

/** Accessible name of an option: status is text, never colour alone. */
export function optionLabel(o: RoleOption, selected: boolean): string {
  const base = o.status === "soon" ? `${o.name}, coming soon, get notified` : o.name;
  return selected ? `${base}, selected` : base;
}
