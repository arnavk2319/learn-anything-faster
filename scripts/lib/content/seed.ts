// Upserts validated content into Postgres. Idempotent: unchanged rows are not rewritten.
// Resource status is written exactly as the content file says; nothing here ever approves a resource.
import type pg from "pg";
import type { Content } from "./load.ts";

export interface SeedResult {
  changed: number;
}

export async function seedContent(client: pg.ClientBase, c: Content): Promise<SeedResult> {
  let changed = 0;
  const run = async (sql: string, params: unknown[]) => {
    changed += (await client.query(sql, params)).rowCount ?? 0;
  };
  await client.query("BEGIN");
  try {
    for (const { item: r } of c.roles)
      await run(
        `INSERT INTO roles (id, name, status) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status
         WHERE (roles.name, roles.status) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.status)`,
        [r.id, r.name, r.status],
      );
    for (const { area, item: t } of c.topics)
      await run(
        `INSERT INTO topics (id, name, area, why, est_hours) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, area = EXCLUDED.area, why = EXCLUDED.why, est_hours = EXCLUDED.est_hours
         WHERE (topics.name, topics.area, topics.why, topics.est_hours) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.area, EXCLUDED.why, EXCLUDED.est_hours)`,
        [t.id, t.name, area, t.why, t.est_hours],
      );
    const topicIds = c.topics.map((t) => t.item.id);
    const edges = c.topics.flatMap((t) => t.item.learn_first.map((p) => [t.item.id, p] as const));
    for (const [t, p] of edges)
      await run(
        `INSERT INTO topic_edges (topic_id, prerequisite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [t, p],
      );
    await run(
      `DELETE FROM topic_edges WHERE topic_id = ANY($1::text[])
       AND (topic_id || '>' || prerequisite_id) <> ALL($2::text[])`,
      [topicIds, edges.map(([t, p]) => `${t}>${p}`)],
    );
    const rts = c.roleTopics.flatMap(({ item: r }) => [
      ...r.requires.map((t) => [r.role, t, "requires"] as const),
      ...r.covers.map((t) => [r.role, t, "covers"] as const),
    ]);
    for (const [role, topic, kind] of rts)
      await run(
        `INSERT INTO role_topics (role_id, topic_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [role, topic, kind],
      );
    await run(
      `DELETE FROM role_topics WHERE role_id = ANY($1::text[])
       AND (role_id || '>' || topic_id || '>' || kind::text) <> ALL($2::text[])`,
      [c.roleTopics.map((r) => r.item.role), rts.map((x) => x.join(">"))],
    );
    for (const { topic, item: r } of c.resources)
      await run(
        `INSERT INTO resources (id, topic_id, type, title, url, is_free, status, last_checked_at, source_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET topic_id = EXCLUDED.topic_id, type = EXCLUDED.type, title = EXCLUDED.title,
           url = EXCLUDED.url, is_free = EXCLUDED.is_free, status = EXCLUDED.status,
           last_checked_at = EXCLUDED.last_checked_at, source_note = EXCLUDED.source_note
         WHERE (resources.topic_id, resources.type, resources.title, resources.url, resources.is_free, resources.status, resources.last_checked_at, resources.source_note)
           IS DISTINCT FROM (EXCLUDED.topic_id, EXCLUDED.type, EXCLUDED.title, EXCLUDED.url, EXCLUDED.is_free, EXCLUDED.status, EXCLUDED.last_checked_at, EXCLUDED.source_note)`,
        [
          r.id,
          topic,
          r.type,
          r.title,
          r.url,
          r.is_free,
          r.status,
          r.last_checked_at ?? null,
          r.source_note ?? null,
        ],
      );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
  return { changed };
}
