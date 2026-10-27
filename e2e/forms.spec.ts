import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import pg from "pg";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const email = `smoke${Date.now()}${String.fromCharCode(64)}example.test`;
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
    "insert into roles values ('smoke-from','From','live'),('smoke-to','To','coming_soon') on conflict do nothing",
  );
  await pool.query(
    "insert into topics values ('smoke-topic','T','x','w',1) on conflict do nothing",
  );
});

test.afterAll(async () => {
  await pool?.query("delete from transition_requests where email = $1", [email]);
  await pool?.end();
});

test("@smoke capture forms submit and validate", async ({ page }) => {
  await page.goto("/dev/forms");
  const request = page.getByRole("form", { name: "Request this move" });
  await request.getByRole("button", { name: "Request this move" }).click();
  await expect(request.getByText("Enter an email address")).toBeVisible();

  await request.getByLabel("Email").fill(email);
  await request.getByRole("button", { name: "Request this move" }).click();
  await expect(page.getByText("Requested. We'll email you when it's mapped.")).toBeVisible();

  const suggest = page.getByRole("form", { name: "Suggest a resource" });
  await suggest.getByLabel("Link").fill("ftp://example.test");
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(suggest.getByText("Enter a link that starts with http or https")).toBeVisible();
  await suggest.getByLabel("Link").fill("https://example.test/guide");
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(page.getByText("Suggested. Thanks, we'll review it.")).toBeVisible();

  const notify = page.getByRole("form", { name: "Notify me" });
  await notify.getByLabel("Email").fill(email);
  await notify.getByRole("button", { name: "Notify me" }).click();
  await expect(page.getByText("You'll be notified.")).toBeVisible();

  // The page never shows the stored email back.
  await expect(page.locator("body")).not.toContainText(email);
});
