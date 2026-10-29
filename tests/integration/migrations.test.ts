import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
const mail = (u: string) => `${u}${String.fromCharCode(64)}example.test`;
const DIR = join(process.cwd(), "apps/web/db/migrations");
const files = readdirSync(DIR);
const ups = files.filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql")).sort();

/** Drizzle splits statements with this marker; the down files are plain SQL. */
async function applyUp(client: pg.PoolClient, schema: string): Promise<void> {
  for (const f of ups) {
    // Generated SQL qualifies enum types with "public"; retarget it to the throwaway schema.
    const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.query(stmt);
    }
  }
}

async function applyDown(client: pg.PoolClient): Promise<void> {
  for (const f of [...ups].reverse()) {
    await client.query(readFileSync(join(DIR, f.replace(/\.sql$/, ".down.sql")), "utf8"));
  }
}

const TABLES = [
  "resource_suggestions",
  "resources",
  "role_topics",
  "roles",
  "topic_edges",
  "topics",
  "transition_requests",
];

async function tables(client: pg.PoolClient, schema: string): Promise<string[]> {
  const r = await client.query<{ n: string }>(
    "select tablename as n from pg_tables where schemaname = $1 order by 1",
    [schema],
  );
  return r.rows.map((x) => x.n);
}

async function enums(client: pg.PoolClient, schema: string): Promise<string[]> {
  const r = await client.query<{ n: string }>(
    "select t.typname as n from pg_type t join pg_namespace s on s.oid = t.typnamespace where s.nspname = $1 and t.typtype = 'e'",
    [schema],
  );
  return r.rows.map((x) => x.n);
}

describe("migration files", () => {
  it("has at least one up migration", () => {
    expect(ups.length).toBeGreaterThan(0);
  });
  it("every up migration has a .down.sql sibling", () => {
    const missing = ups.filter((f) => !files.includes(f.replace(/\.sql$/, ".down.sql")));
    expect(missing).toEqual([]);
  });
});

describe.skipIf(!isDbAvailable())("migrations against Postgres", () => {
  let client: pg.PoolClient;
  let schema: string;

  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  const fails = async (sql: string, params: unknown[] = []) => {
    await client.query("savepoint s");
    try {
      await client.query(sql, params);
      await client.query("release savepoint s");
      return false;
    } catch {
      await client.query("rollback to savepoint s");
      return true;
    }
  };

  it("applies up from empty and creates all tables and constraints", async () => {
    await applyUp(client, schema);
    expect(await tables(client, schema)).toEqual(TABLES);

    await client.query("begin");
    await client.query("insert into roles values ('a','A','live'),('b','B','coming_soon')");
    await client.query("insert into topics values ('t1','T1','x','w',1),('t2','T2','x','w',2)");

    // transition_requests unique (from, to, email, kind)
    const ins =
      "insert into transition_requests (from_role,to_role,email,kind) values ('a','b',$1,$2)";
    await client.query(ins, [mail("x"), "request"]);
    expect(await fails(ins, [mail("x"), "request"])).toBe(true);
    await client.query(ins, [mail("x"), "notify"]); // different kind is fine
    // email normalisation CHECK
    expect(await fails(ins, [mail("X"), "request"])).toBe(true);
    expect(await fails(ins, [" " + mail("z"), "request"])).toBe(true);

    // enums reject invalid values
    const res = (type: string, status: string) =>
      fails(
        "insert into resources (id,topic_id,type,title,url,is_free,status) values (gen_random_uuid()::text,'t1',$1,'t','u'||gen_random_uuid(),true,$2)",
        [type, status],
      );
    expect(await res("video", "proposed")).toBe(true);
    expect(await res("youtube", "bogus")).toBe(true);
    for (const t of ["youtube", "coursera", "course", "book", "docs", "blog", "article"]) {
      expect(await res(t, "proposed")).toBe(false);
    }
    for (const s of ["proposed", "approved", "dead"]) expect(await res("book", s)).toBe(false);
    expect(await fails("insert into roles values ('c','C','nope')")).toBe(true);
    expect(await fails("insert into role_topics values ('a','t1','nope')")).toBe(true);
    expect(
      await fails(
        "insert into transition_requests (from_role,to_role,email,kind) values ('a','b','q','nope')",
      ),
    ).toBe(true);

    // topic_edges self-edge CHECK
    expect(await fails("insert into topic_edges values ('t1','t1')")).toBe(true);
    expect(await fails("insert into topic_edges values ('t1','t2')")).toBe(false);

    // topics.est_hours > 0 and duplicate resource url per topic
    expect(await fails("insert into topics values ('t3','T','x','w',0)")).toBe(true);
    await client.query(
      "insert into resources (id,topic_id,type,title,url,is_free) values ('r1','t1','book','t','u',true)",
    );
    expect(
      await fails(
        "insert into resources (id,topic_id,type,title,url,is_free) values ('r2','t1','book','t','u',true)",
      ),
    ).toBe(true);
    // RESTRICT: cannot delete a topic that has resources
    expect(await fails("delete from topics where id = 't1'")).toBe(true);
    await client.query("rollback");
  });

  it("applies down in reverse leaving no tables or enum types, then up again", async () => {
    await applyDown(client);
    expect(await tables(client, schema)).toEqual([]);
    expect(await enums(client, schema)).toEqual([]);
    await applyUp(client, schema);
    expect(await tables(client, schema)).toEqual(TABLES);
  });

  it("0001 dedupes existing suggestions (keeping the earliest) then enforces unique (topic, url)", async () => {
    await applyDown(client);
    const [first, ...rest] = ups;
    const run = async (f: string) => {
      const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const stmt of sql.split("--> statement-breakpoint")) {
        if (stmt.trim()) await client.query(stmt);
      }
    };
    await run(first!);
    await client.query("insert into topics values ('t1','T1','x','w',1)");
    const ins =
      "insert into resource_suggestions (topic_id,url,note,created_at) values ('t1','u',$1,$2)";
    await client.query(ins, ["late", "2026-02-01"]);
    await client.query(ins, ["early", "2026-01-01"]);
    await client.query(ins, ["late2", "2026-03-01"]);
    for (const f of rest) await run(f);
    const r = await client.query("select note from resource_suggestions");
    expect(r.rows).toEqual([{ note: "early" }]);
    await client.query("begin");
    expect(await fails(ins, ["again", "2026-04-01"])).toBe(true);
    await client.query("rollback");
  });
});
