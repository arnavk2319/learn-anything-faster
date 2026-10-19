import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { inject } from "vitest";

const URL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: URL, max: 10 });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** True when the global setup reached the DB. Use with describe.skipIf(!isDbAvailable()). */
export function isDbAvailable(): boolean {
  return inject("dbAvailable") === true;
}

function checkName(schema: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("invalid schema name");
  return schema;
}

/** Recreates a throwaway schema (unique per call unless named) and returns a client pinned to it via search_path. */
export async function resetSchema(
  name?: string,
): Promise<{ schema: string; client: pg.PoolClient }> {
  const schema = checkName(name ?? `t_${randomBytes(6).toString("hex")}`);
  const client = await getPool().connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  return { schema, client };
}

export async function dropSchema(schema: string): Promise<void> {
  await getPool().query(`DROP SCHEMA IF EXISTS ${checkName(schema)} CASCADE`);
}

/** Applies every *.sql in dir in filename order. Fixtures must be idempotent; running twice is safe. */
export async function loadFixtures(dir: string, client: pg.PoolClient): Promise<string[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) await client.query(readFileSync(join(dir, f), "utf8"));
  return files;
}
