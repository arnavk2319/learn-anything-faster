// Landing data: live roles plus which ordered pairs are curated, using the roadmap service's rule.
import { eq } from "drizzle-orm";
import { roles, roleTopics } from "../../db/schema";
import { isCuratedPair, type RoadmapDb } from "./service";

export type LandingRole = { id: string; name: string };
export type LandingData = { roles: LandingRole[]; curated: { from: string; to: string }[] };

export async function getLandingData(db: RoadmapDb): Promise<LandingData> {
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, status: roles.status })
    .from(roles);
  const requiresRows = await db
    .select({ roleId: roleTopics.roleId })
    .from(roleTopics)
    .where(eq(roleTopics.kind, "requires"));
  const counts = new Map<string, number>();
  for (const r of requiresRows) counts.set(r.roleId, (counts.get(r.roleId) ?? 0) + 1);

  const live = roleRows
    .filter((r) => r.status === "live")
    .sort((a, b) => a.name.localeCompare(b.name));
  const curated = live.flatMap((from) =>
    live
      .filter((to) => isCuratedPair(from, to, counts.get(to.id) ?? 0))
      .map((to) => ({ from: from.id, to: to.id })),
  );
  return { roles: live.map(({ id, name }) => ({ id, name })), curated };
}
