import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { seedContent } from "../../scripts/lib/content/seed.ts";
import { validateContent } from "../../scripts/lib/content/validate.ts";
import { validFixture, res, writeFixture } from "../../tests/fixtures/content-fixture.ts";

// Same dev / dev2 / ml-dev fixture as e2e/roadmap.spec.ts, for specs that must not depend on spec order.
export async function seedRoadmapFixture(): Promise<void> {
  if (process.env.BASE_URL) return;
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test",
  });
  try {
    if (!(await pool.query("select to_regclass('public.roles') as t")).rows[0].t) {
      const dir = join(process.cwd(), "apps/web/db/migrations");
      for (const f of readdirSync(dir)
        .filter((x) => x.endsWith(".sql") && !x.endsWith(".down.sql"))
        .sort())
        for (const s of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint"))
          if (s.trim()) await pool.query(s);
    }
    const f = validFixture();
    f.roles = [
      { id: "dev", name: "Developer", status: "live" },
      { id: "dev2", name: "Developer two", status: "live" },
      { id: "ml-dev", name: "ML developer", status: "live" },
      { id: "later-role", name: "Later", status: "coming_soon" },
    ];
    f.topics["deep"] = {
      area: "deep",
      topics: [
        { id: "torch", name: "Torch", why: "Frameworks.", est_hours: 6, learn_first: ["stats"] },
      ],
    };
    f.roleTopics = [
      { role: "dev", covers: ["python"] },
      { role: "dev2", covers: ["algebra", "python"] },
      { role: "ml-dev", requires: ["stats", "python", "torch"], covers: [] },
    ];
    f.resources["torch"] = res("torch");
    const { content, errors } = validateContent(writeFixture(f));
    if (errors.length) throw new Error(errors.join("; "));
    const client = await pool.connect();
    try {
      await seedContent(client, content);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
