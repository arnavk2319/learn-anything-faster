import { expect, test } from "@playwright/test";
import pg from "pg";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
let pool: pg.Pool | undefined;

test.beforeAll(async () => {
  if (process.env.BASE_URL) return;
  pool = new pg.Pool({ connectionString: DB });
  await pool.query(
    "insert into roles values ('full-stack-engineer','Full-stack engineer','live'),('ml-engineer','ML engineer','live') on conflict do nothing",
  );
  await pool.query("insert into topics values ('shell-t','T','x','w',1) on conflict do nothing");
  await pool.query(
    "insert into role_topics (role_id, topic_id, kind) values ('ml-engineer','shell-t','requires') on conflict do nothing",
  );
});
test.afterAll(async () => {
  await pool?.end();
});

test("fonts: heading and body families differ, self-hosted, no font CDN", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) external.push(r.url());
  });
  await page.goto("/roadmaps");
  await page.evaluate("document.fonts.ready.then(() => true)");
  const fam = async (sel: string) =>
    (await page.evaluate(
      `getComputedStyle(document.querySelector(${JSON.stringify(sel)})).fontFamily`,
    )) as string;
  const heading = await fam("h1");
  const body = await fam("body");
  expect(heading).toContain("Familjen");
  expect(body).toContain("Hanken");
  expect(heading).not.toEqual(body);
  expect(external).toEqual([]);
});

test("header: logo links home, nav marks the current page", async ({ page }) => {
  await page.goto("/roadmaps");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Learn Anything Faster" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(header.getByRole("link", { name: "Browse roadmaps" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("landing: route preview and popular moves open the roadmap; axe clean", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-state", "abstract");
  await expectNoA11yViolations(page, { label: "landing" });
  await page.getByLabel("I am a").selectOption("full-stack-engineer");
  await page.getByLabel("and I want to be a").selectOption("ml-engineer");
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-state", "live");
  await expect(page.getByTestId("route-line")).toContainText("You are here");
  await expectNoA11yViolations(page, { label: "landing live preview" });
  await page
    .getByRole("region", { name: "Popular moves" })
    .getByRole("link", { name: /Full-stack engineer to ML engineer/ })
    .click();
  await expect(page).toHaveURL(/\/roadmap\/full-stack-engineer\/ml-engineer/);
});

test("landing: unmapped choice mutes the route line", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // selects are controlled: wait for hydration
  await page.getByLabel("I am a").selectOption("ml-engineer");
  await page.getByLabel("and I want to be a").selectOption("full-stack-engineer");
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-state", "unmapped");
});
