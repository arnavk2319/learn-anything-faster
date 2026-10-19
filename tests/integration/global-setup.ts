import pg from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    dbAvailable: boolean;
  }
}

const URL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const WAIT_MS = 30_000;

async function ping(): Promise<boolean> {
  const client = new pg.Client({ connectionString: URL, connectionTimeoutMillis: 2_000 });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Waits up to 30s for the test DB. CI set: unreachable DB fails the run. Otherwise DB tests skip. */
export default async function setup(project: TestProject): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  let ok = await ping();
  while (!ok && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_000));
    ok = await ping();
  }
  if (!ok && process.env.CI) {
    throw new Error(
      "Test Postgres unreachable after 30s and CI is set. Run `pnpm db:test:up` or fix the service container.",
    );
  }
  if (!ok) {
    console.warn(
      "[integration] Test Postgres unreachable: DB-dependent tests will be SKIPPED. Run `pnpm db:test:up` to enable them.",
    );
  }
  project.provide("dbAvailable", ok);
}
