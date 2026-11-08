import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formDbFromPg } from "../../apps/web/lib/forms/service";
import { createDbLimiter } from "../../apps/web/lib/forms/rate-limit-db";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const URL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const DIR = join(process.cwd(), "apps/web/db/migrations");
const WINDOW = 600_000;

describe.skipIf(!isDbAvailable())("shared rate limiter against Postgres", () => {
  let schema: string;
  const pools: pg.Pool[] = [];
  // Each limiter gets its own pool (a separate "serverless instance") pinned to the throwaway schema.
  const instance = () => {
    const pool = new pg.Pool({
      connectionString: URL,
      max: 20,
      options: `-c search_path=${schema}`,
    });
    pools.push(pool);
    return { pool, db: formDbFromPg(pool) };
  };
  type Inst = ReturnType<typeof instance>;
  const rows = async (i: Inst) =>
    (
      await i.pool.query<{ key: string; count: number; window_start: Date }>(
        "select key, count, window_start from rate_limits",
      )
    ).rows;

  beforeAll(async () => {
    const r = await resetSchema();
    schema = r.schema;
    const file = readdirSync(DIR).find((f) => /^0002_.*\.sql$/.test(f) && !f.endsWith(".down.sql"));
    if (!file) throw new Error("rate_limits migration missing");
    const sqlText = readFileSync(join(DIR, file), "utf8").replaceAll('"public".', `"${schema}".`);
    for (const s of sqlText.split("--> statement-breakpoint"))
      if (s.trim()) await r.client.query(s);
    r.client.release();
  });
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
    await dropSchema(schema);
    await closePool();
  });

  it("two independent limiter instances share one count, keys are hashed", async () => {
    const a = createDbLimiter(instance().db, 3, WINDOW, { random: () => 1 });
    const b = createDbLimiter(instance().db, 3, WINDOW, { random: () => 1 });
    const got = [
      await a("t:5.6.7.8"),
      await b("t:5.6.7.8"),
      await a("t:5.6.7.8"),
      await b("t:5.6.7.8"),
    ];
    expect(got).toEqual([true, true, true, false]);
    const stored = await rows(instance());
    expect(stored).toHaveLength(1);
    expect(stored[0]?.key).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[0]?.key).not.toContain("5.6.7.8");
    expect(stored[0]?.count).toBe(4);
  });

  it("an old window does not count: a new window starts again at 1", async () => {
    const inst = instance();
    const { db, pool } = inst;
    await pool.query("insert into rate_limits values ($1, now() - interval '3 hours', 99)", [
      "f".repeat(64),
    ]);
    const l = createDbLimiter(db, 1, WINDOW, { random: () => 1 });
    expect(await l("other:1.1.1.1")).toBe(true);
    const aligned = await pool.query(
      "select (date_bin('10 minutes', now(), 'epoch') = max(window_start)) as ok from rate_limits where key <> $1",
      ["f".repeat(64)],
    );
    expect(aligned.rows[0].ok).toBe(true);
  });

  it("50 concurrent calls allow exactly the limit", async () => {
    const l = createDbLimiter(instance().db, 5, WINDOW, { random: () => 1 });
    const results = await Promise.all(Array.from({ length: 50 }, () => l("burst:2.2.2.2")));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("prune removes only old rows and at most 100 per run", async () => {
    const inst = instance();
    const { db, pool } = inst;
    await pool.query("delete from rate_limits");
    await pool.query(`
      insert into rate_limits (key, window_start, count)
      select md5(i::text) || md5(i::text), now() - interval '2 hours', 1 from generate_series(1, 150) i`);
    await pool.query("insert into rate_limits values ($1, now(), 1)", ["e".repeat(64)]);
    const l = createDbLimiter(db, 5, WINDOW, { random: () => 0 }); // always prune
    await l("prune:3.3.3.3");
    await new Promise((r) => setTimeout(r, 200));
    const left = await rows(inst);
    expect(left.filter((r) => r.key !== "e".repeat(64)).length).toBe(50 + 1); // 150 old - 100 pruned, +1 new
    expect(left.some((r) => r.key === "e".repeat(64))).toBe(true);
  });
});
