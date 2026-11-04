import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const email = `cat${Date.now()}${String.fromCharCode(64)}example.test`;
let pool: pg.Pool | undefined;

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
    "insert into roles values ('cat-a','Catalog Alpha','live'),('cat-b','Catalog Beta','live') on conflict do nothing",
  );
  await pool.query(
    "insert into topics values ('cat-t','Catalog Topic','Why it matters.','w',1) on conflict do nothing",
  );
  await pool.query(
    "insert into role_topics (role_id, topic_id, kind) values ('cat-b','cat-t','requires') on conflict do nothing",
  );
});

test.afterAll(async () => {
  await pool?.query("delete from transition_requests where email = $1", [email]);
  await pool?.end();
});

test("@smoke catalog filters via the URL, links Live and notifies on Coming soon", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse all roadmaps" }).click();
  await expect(page).toHaveURL(/\/roadmaps$/);

  const live = page
    .getByTestId("catalog-entry")
    .filter({ hasText: "Catalog Alpha to Catalog Beta" });
  const soon = page
    .getByTestId("catalog-entry")
    .filter({ hasText: "Catalog Beta to Catalog Alpha" });
  await expect(live).toContainText("Live");
  await expect(soon).toContainText("Coming soon");

  await page.getByRole("link", { name: "Live", exact: true }).click();
  await expect(page).toHaveURL(/status=live/);
  await expect(soon).toHaveCount(0);
  await expect(live).toBeVisible();

  await page.getByRole("link", { name: "Coming soon", exact: true }).click();
  await expect(page).toHaveURL(/status=coming-soon/);
  await expect(live).toHaveCount(0);

  const form = soon.getByRole("form", { name: "Notify me about Catalog Beta to Catalog Alpha" });
  await form.getByRole("button", { name: "Notify me" }).click();
  await expect(form.getByText("Enter an email address")).toBeVisible();
  await form.getByLabel("Email").fill(email);
  await expect(form.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 20_000,
  });
  await form.getByRole("button", { name: "Notify me" }).click();
  await expect(soon.getByRole("status")).toHaveText("You'll be notified.");
  await expect(page.locator("body")).not.toContainText(email);

  await page.getByRole("link", { name: "All", exact: true }).click();
  await page
    .getByTestId("catalog-entry")
    .filter({ hasText: "Catalog Alpha to Catalog Beta" })
    .getByRole("link", { name: "View roadmap" })
    .click();
  await expect(page).toHaveURL(/\/roadmap\/cat-a\/cat-b/);
});

test("axe: /roadmaps default, filtered, and notify-me validation error", async ({ page }) => {
  await page.goto("/roadmaps");
  await expect(page.getByTestId("catalog-entry").first()).toBeVisible();
  await expectNoA11yViolations(page, { label: "roadmaps default" });

  await page.getByRole("link", { name: "Coming soon", exact: true }).click();
  await expect(page).toHaveURL(/status=coming-soon/);
  const soon = page
    .getByTestId("catalog-entry")
    .filter({ hasText: "Catalog Beta to Catalog Alpha" });
  await expectNoA11yViolations(page, { label: "roadmaps coming soon, idle form" });
  await soon.getByRole("button", { name: "Notify me" }).click();
  await expect(soon.getByText("Enter an email address")).toBeVisible();
  await expectNoA11yViolations(page, { label: "roadmaps notify validation error" });
});
