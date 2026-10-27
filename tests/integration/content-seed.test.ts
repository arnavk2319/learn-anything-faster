import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "../../scripts/lib/content/seed.ts";
import { validateContent } from "../../scripts/lib/content/validate.ts";
import { res, validFixture, writeFixture } from "../fixtures/content-fixture.ts";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const DIR = join(process.cwd(), "apps/web/db/migrations");

async function migrate(client: pg.PoolClient, schema: string) {
  const ups = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
  for (const f of ups) {
    const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
    for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await client.query(s);
  }
}

function load(mutate?: (f: ReturnType<typeof validFixture>) => void) {
  const f = validFixture();
  f.resources.stats = res("stats", "proposed"); // seed does not require approval coverage
  mutate?.(f);
  const { content } = validateContent(writeFixture(f));
  return content;
}

describe.skipIf(!isDbAvailable())("content:seed", () => {
  let client: pg.PoolClient;
  let schema: string;
  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
    await migrate(client, schema);
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  const count = async (t: string) =>
    Number((await client.query<{ n: string }>(`select count(*) n from ${t}`)).rows[0]!.n);

  it("loads fixtures and is idempotent", async () => {
    const c = load();
    const first = await seedContent(client, c);
    expect(first.changed).toBeGreaterThan(0);
    expect(await count("topics")).toBe(3);
    expect(await count("topic_edges")).toBe(1);
    expect(await count("role_topics")).toBe(3);
    const before = (await client.query("select * from resources order by id")).rows;
    const second = await seedContent(client, c);
    expect(second.changed).toBe(0);
    expect((await client.query("select * from resources order by id")).rows).toEqual(before);
  });

  it("writes resource status exactly as in the files (proposed stays proposed)", async () => {
    const r = await client.query<{ id: string; status: string }>(
      "select id, status from resources order by id",
    );
    expect(Object.fromEntries(r.rows.map((x) => [x.id, x.status]))).toEqual({
      "algebra-docs": "approved",
      "python-docs": "approved",
      "stats-docs": "proposed",
    });
  });

  it("removes edges dropped from content", async () => {
    await seedContent(
      client,
      load((f) => {
        (f.topics.math as { topics: { learn_first?: string[] }[] }).topics[1]!.learn_first = [];
      }),
    );
    expect(await count("topic_edges")).toBe(0);
  });
});
