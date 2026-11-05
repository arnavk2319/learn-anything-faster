import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import pg from "pg";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const email = `smoke${Date.now()}${String.fromCharCode(64)}example.test`;
let pool: pg.Pool | undefined;
const url = `https://example.test/guide-${Date.now()}`;

// The widget fills the hidden token field asynchronously; submit only once it is non-empty.
async function tokenReady(form: Locator) {
  await expect(form.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 20_000,
  });
}

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
  await tokenReady(request);
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
  await tokenReady(suggest);
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(page.getByText("Suggested. Thanks, we'll review it.")).toBeVisible();
});

test("suggesting the same link twice succeeds both times and keeps one row", async ({ page }) => {
  const dup = `https://example.test/dup-${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    const suggest = await openSuggest(page);
    await suggest.getByLabel("Link").fill(dup);
    await tokenReady(suggest);
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

test("a missing or rejected Turnstile token shows the blocked message and stores nothing", async ({
  page,
}) => {
  const blockedEmail = `blocked${Date.now()}${String.fromCharCode(64)}example.test`;
  await page.goto("/");
  await page.getByLabel("I am a").selectOption("forms-a");
  await page.getByLabel("and I want to be a").selectOption("forms-c");
  const request = page.getByRole("form", { name: "Request this move" });
  await tokenReady(request);
  await request.getByLabel("Email").fill(blockedEmail);
  // Blank the token after typing (typing re-renders and would restore it), as a bot posting without solving the challenge would (siteverify rejects empty input).
  await request
    .locator('input[name="cf-turnstile-response"]')
    .evaluate((el) => ((el as { value: string }).value = ""));
  await request.getByRole("button", { name: "Request this move" }).click();
  const msg = request.getByText(
    "We couldn't verify you're human. Reload the challenge and try again.",
  );
  await expect(msg.first()).toBeVisible();
  await expect(request.getByLabel("Email")).toHaveValue(blockedEmail);
  if (pool) {
    const r = await pool.query(
      "select count(*)::int as n from transition_requests where email = $1",
      [blockedEmail],
    );
    expect(r.rows[0].n).toBe(0);
  }
});

test("axe: request and suggest forms, idle and validation-error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("I am a").selectOption("forms-a");
  await page.getByLabel("and I want to be a").selectOption("forms-c");
  const request = page.getByRole("form", { name: "Request this move" });
  await expect(request).toBeVisible();
  await tokenReady(request);
  await expectNoA11yViolations(page, { label: "request idle" });
  await request.getByRole("button", { name: "Request this move" }).click();
  await expect(request.getByText("Enter an email address")).toBeVisible();
  await expectNoA11yViolations(page, { label: "request error" });

  const suggest = await openSuggest(page);
  await expectNoA11yViolations(page, { label: "suggest idle" });
  await suggest.getByLabel("Link").fill("ftp://example.test");
  await suggest.getByRole("button", { name: "Suggest a resource" }).click();
  await expect(suggest.getByText("Enter a link that starts with http or https")).toBeVisible();
  await expectNoA11yViolations(page, { label: "suggest error" });
});
