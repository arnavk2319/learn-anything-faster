// Roadmap resolution (spec "Roadmap request flow" steps 2-4). Takes the db as a parameter so
// integration tests can pin a schema. Selects explicit columns: never an email, never a non-approved resource.
import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import { computeDelta } from "../../../../packages/graph/src/index";
import { resources, roles, roleTopics, topicEdges, topics } from "../../db/schema";
import type { RoadmapResponse } from "./schema";

/** Wraps a pg pool or client (tests pin a schema through a client). */
export const roadmapDbFromPg = (c: Pool | PoolClient) => drizzle(c);

export type RoadmapDb = Pick<NodePgDatabase, "select">;

/** The single curated-pair rule: distinct roles, both live, and the target requires at least one topic. */
export function isCuratedPair(
  from: { id: string; status: string },
  to: { id: string; status: string },
  targetRequiresCount: number,
): boolean {
  return (
    from.id !== to.id && from.status === "live" && to.status === "live" && targetRequiresCount > 0
  );
}

/** Returns null when the pair is unknown or uncurated (a role missing, not live, or target requires nothing). */
export async function getRoadmap(
  db: RoadmapDb,
  from: string,
  to: string,
): Promise<RoadmapResponse | null> {
  if (from === to) return null;
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, status: roles.status })
    .from(roles)
    .where(inArray(roles.id, [from, to]));
  const fromRole = roleRows.find((r) => r.id === from);
  const toRole = roleRows.find((r) => r.id === to);
  if (!fromRole || !toRole) return null;

  const rt = await db
    .select({ roleId: roleTopics.roleId, topicId: roleTopics.topicId, kind: roleTopics.kind })
    .from(roleTopics)
    .where(inArray(roleTopics.roleId, [from, to]));
  const requires = rt.filter((r) => r.roleId === to && r.kind === "requires").map((r) => r.topicId);
  if (!isCuratedPair(fromRole, toRole, requires.length)) return null;
  const covers = rt.filter((r) => r.roleId === from && r.kind === "covers").map((r) => r.topicId);

  const edgeRows = await db
    .select({ topicId: topicEdges.topicId, prerequisiteId: topicEdges.prerequisiteId })
    .from(topicEdges);
  const delta = computeDelta({ requires, covers, edges: edgeRows });

  const ids = [...delta.order, ...delta.covered];
  const topicRows = await db
    .select({
      id: topics.id,
      name: topics.name,
      area: topics.area,
      why: topics.why,
      estHours: topics.estHours,
    })
    .from(topics)
    .where(inArray(topics.id, ids));
  const byId = new Map(topicRows.map((t) => [t.id, t]));

  const resRows = await db
    .select({
      id: resources.id,
      topicId: resources.topicId,
      type: resources.type,
      title: resources.title,
      url: resources.url,
      isFree: resources.isFree,
    })
    .from(resources)
    .where(and(inArray(resources.topicId, delta.order), eq(resources.status, "approved")))
    .orderBy(asc(resources.id));

  const nodes = delta.order.flatMap((id) => {
    const t = byId.get(id);
    if (!t) return [];
    return [
      {
        ...t,
        resources: resRows
          .filter((r) => r.topicId === id)
          .map((r) => ({ id: r.id, type: r.type, title: r.title, url: r.url, isFree: r.isFree })),
      },
    ];
  });
  const covered = delta.covered.flatMap((id) => {
    const t = byId.get(id);
    return t ? [{ id: t.id, name: t.name, area: t.area }] : [];
  });

  return {
    from: { id: fromRole.id, name: fromRole.name },
    to: { id: toRole.id, name: toRole.name },
    nodes,
    edges: delta.edges.map((e) => ({ topicId: e.topicId, prerequisiteId: e.prerequisiteId })),
    covered,
  };
}
