import { join } from "node:path";
import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  closePool,
  dropSchema,
  getPool,
  isDbAvailable,
  loadFixtures,
  resetSchema,
} from "./harness";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

describe.skipIf(!isDbAvailable())("postgres harness", () => {
  const schemas: string[] = [];
  const clients: pg.PoolClient[] = [];
  async function fresh() {
    const r = await resetSchema();
    schemas.push(r.schema);
    clients.push(r.client);
    return r;
  }
  afterAll(async () => {
    clients.forEach((c) => c.release());
    for (const s of schemas) await dropSchema(s);
    await closePool();
  });

  it("connects", async () => {
    const r = await getPool().query("select 1 as ok");
    expect(r.rows[0].ok).toBe(1);
  });

  it("resets the schema to empty", async () => {
    const { schema, client } = await fresh();
    await client.query("create table t (id int)");
    const again = await resetSchema(schema);
    clients.push(again.client);
    const r = await again.client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = $1",
      [schema],
    );
    expect(r.rows[0].n).toBe(0);
  });

  it("loads fixtures in filename order", async () => {
    const { client } = await fresh();
    const files = await loadFixtures(FIXTURES, client);
    expect(files).toEqual([...files].sort());
    const r = await client.query("select count(*)::int as n from widgets");
    expect(r.rows[0].n).toBe(2);
  });

  it("fixture loader is idempotent", async () => {
    const { client } = await fresh();
    await loadFixtures(FIXTURES, client);
    await loadFixtures(FIXTURES, client);
    const r = await client.query("select count(*)::int as n from widgets");
    expect(r.rows[0].n).toBe(2);
  });

  it("isolates schemas between test files", async () => {
    const a = await fresh();
    const b = await fresh();
    expect(a.schema).not.toBe(b.schema);
    await a.client.query("create table only_a (id int)");
    const r = await b.client.query("select to_regclass('only_a') as t");
    expect(r.rows[0].t).toBeNull();
  });
});
