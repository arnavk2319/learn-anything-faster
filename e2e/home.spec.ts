import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import pg from "pg";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
let pool: pg.Pool | undefined;

test.beforeAll(async () => {
  if (process.env.BASE_URL) return; // remote targets have their own data
  pool = new pg.Pool({ connectionString: DB });
  const has = await pool.query("select to_regclass('public.roles') as t");
  if (!has.rows[0].t) {
    const dir = join(process.cwd(), "apps/web/db/migrations");
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith(".sql") && !x.endsWith(".down.sql"))
      .sort()) {
      for (const s of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) {
        if (s.trim()) await pool.query(s);
      }
    }
  }
  await pool.query(
    "insert into roles values ('home-a','Home Alpha','live'),('home-b','Home Beta','live'),('home-c','Home Gamma','live') on conflict do nothing",
  );
  await pool.query("insert into topics values ('home-t','T','x','w',1) on conflict do nothing");
  await pool.query(
    "insert into role_topics (role_id, topic_id, kind) values ('home-b','home-t','requires') on conflict do nothing",
  );
});

test.afterAll(async () => {
  await pool?.query("delete from transition_requests where from_role like 'home-%'");
  await pool?.end();
});

test("@smoke home lists live roles in both pickers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("I am a").getByRole("option", { name: "Home Alpha" })).toHaveCount(
    1,
  );
  await expect(
    page.getByLabel("and I want to be a").getByRole("option", { name: "Home Beta" }),
  ).toHaveCount(1);
});

test("F1 curated pair opens the roadmap, keyboard operable", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("I am a").focus();
  await page.keyboard.press("Tab"); // moves to target select (labels are not tab stops)
  await expect(page.getByLabel("and I want to be a")).toBeFocused();
  await page.getByLabel("I am a").selectOption("home-a");
  await page.getByLabel("and I want to be a").selectOption("home-b");
  const link = page.getByRole("link", { name: "Show my roadmap" });
  await expect(link).toHaveAttribute("href", "/roadmap?from=home-a&to=home-b");
});

test("F1 uncurated pair shows the Request-it form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("I am a").selectOption("home-a");
  await page.getByLabel("and I want to be a").selectOption("home-c");
  await expect(page.getByText("This move isn't mapped yet.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Request this move" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show my roadmap" })).toHaveCount(0);
});
