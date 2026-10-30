import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const email = `smoke${Date.now()}${String.fromCharCode(64)}example.test`;
let pool: pg.Pool | undefined;
const url = `https://example.test/guide-${Date.now()}`;

test.beforeAll(async () => {
  if (process.env.BASE_URL) return; // remote targets have their own data
  pool = new pg.Pool({ connectionString: DB });
  const has = await pool.query("select to_regclass('public.transition_requests') as t");
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
    "insert into roles values ('forms-a','Forms Alpha','live'),('forms-b','Forms Beta','live'),('forms-c','Forms Gamma','live') on conflict do nothing",
  );
  await pool.query(
    "insert into topics values ('forms-t','Forms Topic','Why it matters.','w',1) on conflict do nothing",
  );
  await pool.query(
    "insert into role_topics (role_id, topic_id, kind) values ('forms-b','forms-t','requires') on conflict do nothing",
  );
});

test.afterAll(async () => {
  await pool?.query("delete from transition_requests where email = $1", [email]);
  await pool?.query("delete from resource_suggestions where topic_id = 'forms-t'");
  await pool?.end();
});

test("@smoke request form on the landing page validates and submits", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("I am a").selectOption("forms-a");
  await page.getByLabel("and I want to be a").selectOption("forms-c");
  const request = page.getByRole("form", { name: "Request this move" });
  await request.getByRole("button", { name: "Request this move" }).click();
  await expect(request.getByText("Enter an email address")).toBeVisible();

  await request.getByLabel("Email").fill(email);
  await request.getByRole("button", { name: "Request this move" }).click();
  await expect(page.getByText("Requested. We'll email you when it's mapped.")).toBeVisible();
  // The page never shows the stored email back.
  await expect(page.locator("body")).not.toContainText(email);
});

async function openSuggest(page: Page) {
  await page.goto("/roadmap/forms-a/forms-b");
  await page.locator('button[data-topic-id="forms-t"]').click();
  const panel = page.getByTestId("topic-panel");
  await panel.locator("summary", { hasText: "Suggest a resource" }).click();
  return panel.getByRole("form", { name: "Suggest a resource" });
}

test("suggest form in the topic panel rejects a bad link, then submits", async ({ page }) => {
  const suggest = await openSuggest(page);
  await suggest.getByLabel("Link").fill("ftp://example.test");
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(suggest.getByText("Enter a link that starts with http or https")).toBeVisible();
  await suggest.getByLabel("Link").fill(url);
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(page.getByText("Suggested. Thanks, we'll review it.")).toBeVisible();
});

test("suggesting the same link twice succeeds both times and keeps one row", async ({ page }) => {
  const dup = `https://example.test/dup-${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    const suggest = await openSuggest(page);
    await suggest.getByLabel("Link").fill(dup);
    await suggest.getByRole("button", { name: "Suggest a resource" }).click();
    await expect(page.getByText("Suggested. Thanks, we'll review it.")).toBeVisible();
  }
  if (pool) {
    const r = await pool.query(
      "select count(*)::int as n from resource_suggestions where topic_id = 'forms-t' and url = $1",
      [dup],
    );
    expect(r.rows[0].n).toBe(1);
  }
});
