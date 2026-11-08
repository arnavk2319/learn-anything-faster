// Catalog of transitions: every ordered pair of distinct roles, Live when curated (same rule as the roadmap API).
import { eq } from "drizzle-orm";
import { roles, roleTopics } from "../../db/schema";
import { isCuratedPair, type RoadmapDb } from "./service";

export type CatalogStatus = "live" | "coming_soon";
export type CatalogEntry = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  status: CatalogStatus;
};
export type CatalogFilter = "all" | "live" | "coming-soon";

export function parseCatalogFilter(v: string | string[] | undefined): CatalogFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "live" || s === "coming-soon" ? s : "all";
}

export function filterCatalog(entries: CatalogEntry[], f: CatalogFilter): CatalogEntry[] {
  if (f === "all") return entries;
  return entries.filter((e) => e.status === (f === "live" ? "live" : "coming_soon"));
}

export async function getCatalog(db: RoadmapDb): Promise<CatalogEntry[]> {
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, status: roles.status })
    .from(roles);
  const requiresRows = await db
    .select({ roleId: roleTopics.roleId })
    .from(roleTopics)
    .where(eq(roleTopics.kind, "requires"));
  const counts = new Map<string, number>();
  for (const r of requiresRows) counts.set(r.roleId, (counts.get(r.roleId) ?? 0) + 1);

  const sorted = [...roleRows].sort((a, b) => a.name.localeCompare(b.name));
  const entries = sorted.flatMap((from) =>
    sorted
      .filter((to) => to.id !== from.id)
      .map((to): CatalogEntry => ({
        from: from.id,
        fromName: from.name,
        to: to.id,
        toName: to.name,
        status: isCuratedPair(from, to, counts.get(to.id) ?? 0) ? "live" : "coming_soon",
      })),
  );
  // Live first, then alphabetical (stable sort keeps the name order within each group).
  return entries.sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));
}
