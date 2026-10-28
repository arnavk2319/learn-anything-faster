import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleHealth, handleRoadmap, ROADMAP_CACHE } from "../../apps/web/lib/roadmap/http";
import { roadmapDbFromPg } from "../../apps/web/lib/roadmap/service";
import { roadmapResponseSchema } from "../../apps/web/lib/roadmap/schema";
import { seedContent } from "../../scripts/lib/content/seed.ts";
import { validateContent } from "../../scripts/lib/content/validate.ts";
import { res, validFixture, writeFixture } from "../fixtures/content-fixture.ts";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const DIR = join(process.cwd(), "apps/web/db/migrations");
// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
const email = `leak${String.fromCharCode(64)}example.test`;

describe.skipIf(!isDbAvailable())("GET /api/roadmap and /api/health", () => {
  let client: pg.PoolClient;
  let schema: string;
  const db = async () => roadmapDbFromPg(client);
  const get = (qs: string) => handleRoadmap(new Request(`http://x/api/roadmap?${qs}`), db);

  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
    const ups = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
      .sort();
    for (const f of ups) {
      const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await client.query(s);
    }
    const f = validFixture();
    const stats = res("stats", "approved");
    stats.resources.push(
      {
        ...stats.resources[0]!,
        id: "stats-proposed",
        url: "https://example.com/p",
        status: "proposed",
      },
      { ...stats.resources[0]!, id: "stats-dead", url: "https://example.com/d", status: "dead" },
    );
    f.resources.stats = stats;
    f.roleTopics = [
      { role: "dev", covers: ["python"] },
      { role: "ml-dev", requires: ["stats", "python"], covers: [] },
      { role: "later-role", requires: ["algebra"], covers: [] },
    ];
    await seedContent(client, validateContent(writeFixture(f)).content);
    await client.query(
      "insert into transition_requests (from_role, to_role, email, kind) values ('dev','later-role',$1,'request')",
      [email],
    );
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  it("returns the ordered delta with approved resources only, no positions, no email", async () => {
    const r = await get("from=dev&to=ml-dev");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe(ROADMAP_CACHE);
    const text = await r.text();
    const body = roadmapResponseSchema.parse(JSON.parse(text));
    expect(body.nodes.map((n) => n.id)).toEqual(["algebra", "stats"]);
    expect(body.edges).toEqual([{ topicId: "stats", prerequisiteId: "algebra" }]);
    expect(body.covered).toEqual([{ id: "python", name: "Python", area: "coding" }]);
    expect(body.nodes[1]!.resources.map((x) => x.id)).toEqual(["stats-docs"]);
    expect(text).not.toMatch(/proposed|dead|position|"x"|"y"|@/);
    expect(text).not.toContain(email);
  });

  it("returns 400 for missing or malformed params", async () => {
    for (const qs of ["", "from=dev", "to=ml-dev", "from=DEV!&to=ml-dev", "from=&to=ml-dev"]) {
      const r = await get(qs);
      expect(r.status, qs).toBe(400);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("returns 404 for unknown, coming-soon, reversed-uncurated and identical pairs", async () => {
    for (const qs of [
      "from=dev&to=nope",
      "from=nope&to=ml-dev",
      "from=dev&to=later-role",
      "from=dev&to=dev",
      "from=ml-dev&to=dev", // dev requires nothing: uncurated
    ]) {
      const r = await get(qs);
      expect(r.status, qs).toBe(404);
      expect(await r.json()).toEqual({ error: "not_found" });
    }
  });

  it("health returns 200 with db ok, 503 when the db fails", async () => {
    const ok = await handleHealth(db);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ status: "ok", db: "ok" });
    const bad = await handleHealth(async () => {
      throw new Error("down");
    });
    expect(bad.status).toBe(503);
  });
});
