import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { filterCatalog, getCatalog, parseCatalogFilter } from "../../apps/web/lib/roadmap/catalog";
import { roadmapDbFromPg } from "../../apps/web/lib/roadmap/service";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const DIR = join(process.cwd(), "apps/web/db/migrations");

describe("catalog filter parsing", () => {
  it("defaults unknown values to all", () => {
    expect(parseCatalogFilter(undefined)).toBe("all");
    expect(parseCatalogFilter("nope")).toBe("all");
    expect(parseCatalogFilter("live")).toBe("live");
    expect(parseCatalogFilter(["coming-soon", "live"])).toBe("coming-soon");
  });
});

describe.skipIf(!isDbAvailable())("getCatalog against Postgres", () => {
  let client: pg.PoolClient;
  let schema: string;

  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
    const ups = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
      .sort();
    for (const f of ups) {
      const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await client.query(s);
    }
    await client.query(
      `insert into roles values ('a','Alpha','live'),('b','Beta','live'),('c','Gamma','coming_soon')`,
    );
    await client.query(`insert into topics values ('t','T','w','Why it matters.',1)`);
    await client.query(
      `insert into role_topics (role_id, topic_id, kind) values ('b','t','requires')`,
    );
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  it("marks only curated ordered pairs Live and lists the rest as Coming soon", async () => {
    const all = await getCatalog(roadmapDbFromPg(client));
    expect(all).toHaveLength(6); // 3 roles, ordered pairs of distinct roles
    const live = filterCatalog(all, "live");
    expect(live.map((e) => `${e.from}>${e.to}`)).toEqual(["a>b"]);
    expect(filterCatalog(all, "coming-soon")).toHaveLength(5);
    expect(all[0]?.status).toBe("live");
    expect(JSON.stringify(all)).not.toContain("@");
  });
});
