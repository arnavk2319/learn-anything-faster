import { expect, test } from "@playwright/test";
import pg from "pg";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
let pool: pg.Pool | undefined;

// Two own curated pairs (p35-a -> p35-b, p35-a -> p35-c) with distinct areas so labels differ.
test.beforeAll(async () => {
  if (process.env.BASE_URL) return;
  pool = new pg.Pool({ connectionString: DB });
  await pool.query(
    `insert into roles values ('p35-a','P35 Start','live'),('p35-b','P35 Beta','live'),('p35-c','P35 Gamma','live') on conflict do nothing`,
  );
  await pool.query(
    `insert into topics values ('p35-t1','Beta topic','alpha-area','x',2),('p35-t2','Gamma topic','omega-area','x',3) on conflict do nothing`,
  );
  await pool.query(
    `insert into role_topics (role_id, topic_id, kind) values ('p35-b','p35-t1','requires'),('p35-c','p35-t2','requires') on conflict do nothing`,
  );
});
test.afterAll(async () => {
  await pool?.end();
});

test("landing preview follows the picked roles in place", async ({ page }) => {
  test.skip(!!process.env.BASE_URL, "needs local test DB fixtures");
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // selects are controlled: wait for hydration
  const line = page.getByTestId("route-line");
  await expect(line).toHaveAttribute("data-state", "abstract");
  await page.getByLabel("I am a").selectOption("p35-a");
  await page.getByLabel("and I want to be a").selectOption("p35-b");
  await expect(line).toContainText("Alpha area");
  await expect(line).toContainText("P35 Beta");
  await page.getByLabel("and I want to be a").selectOption("p35-c");
  await expect(line).toContainText("Omega area");
  await expect(line).not.toContainText("Alpha area");
  await page.getByLabel("and I want to be a").selectOption("p35-a");
  await expect(line).toHaveAttribute("data-state", "abstract");
});

test("landing preview ignores a slow earlier response", async ({ page }) => {
  test.skip(!!process.env.BASE_URL, "needs local test DB fixtures");
  await page.route("**/api/roadmap?*to=p35-b*", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // selects are controlled: wait for hydration
  await page.getByLabel("I am a").selectOption("p35-a");
  await page.getByLabel("and I want to be a").selectOption("p35-b");
  await page.getByLabel("and I want to be a").selectOption("p35-c");
  const line = page.getByTestId("route-line");
  await expect(line).toContainText("Omega area");
  await page.waitForTimeout(1600);
  await expect(line).toContainText("Omega area");
  await expect(line).not.toContainText("Alpha area");
});

test("landing preview falls back to abstract when the API errors", async ({ page }) => {
  test.skip(!!process.env.BASE_URL, "needs local test DB fixtures");
  await page.route("**/api/roadmap?*", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // selects are controlled: wait for hydration
  await page.getByLabel("I am a").selectOption("p35-a");
  await page.getByLabel("and I want to be a").selectOption("p35-b");
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-state", "abstract");
});
