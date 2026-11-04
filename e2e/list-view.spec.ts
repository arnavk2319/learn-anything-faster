import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedContent } from "../scripts/lib/content/seed.ts";
import { validateContent } from "../scripts/lib/content/validate.ts";
import { validFixture, res, writeFixture } from "../tests/fixtures/content-fixture.ts";

const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";

// Fixture: dev to ml-dev has areas math (algebra, stats) and deep (torch), with python covered.
// dev2 covers algebra instead, so switching the current role changes the graph.
function fixture() {
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
  return f;
}

test.beforeAll(async () => {
  if (process.env.BASE_URL) return;
  const pool = new pg.Pool({ connectionString: DB });
  const has = await pool.query("select to_regclass('public.roles') as t");
  if (!has.rows[0].t) {
    const dir = join(process.cwd(), "apps/web/db/migrations");
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith(".sql") && !x.endsWith(".down.sql"))
      .sort())
      for (const s of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint"))
        if (s.trim()) await pool.query(s);
  }
  const { content, errors } = validateContent(writeFixture(fixture()));
  if (errors.length) throw new Error(errors.join("; "));
  const client = await pool.connect();
  try {
    await seedContent(client, content);
  } finally {
    client.release();
    await pool.end();
  }
});

const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
const list = (page: Page) => page.getByTestId("roadmap-list");
const IDS = ["algebra", "stats", "torch"];

test("graph is the default; the toggle switches to the list and back", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
  await expect(list(page)).toHaveCount(0);
  const toggle = page.getByRole("group", { name: "View" });
  await expect(toggle.getByRole("button", { name: "Graph" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await toggle.getByRole("button", { name: "List" }).click();
  await expect(list(page)).toBeVisible();
  await expect(page.locator(".react-flow")).toHaveCount(0);
  await expect(page).toHaveURL(/view=list/);
  await expect(toggle.getByRole("button", { name: "List" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Nested structure: area headings, then topics in route order (prerequisites first).
  await expect(list(page).getByRole("heading", { name: /^Math/ })).toBeVisible();
  await expect(list(page).getByRole("heading", { name: /^Deep/ })).toBeVisible();
  await expect(list(page).getByRole("list")).toHaveCount(1 + 2); // areas + one ordered list each
  const order = await list(page)
    .locator("button[data-topic-id]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-topic-id")));
  expect(order.indexOf("algebra")).toBeLessThan(order.indexOf("stats"));
  expect(order.indexOf("stats")).toBeLessThan(order.indexOf("torch"));
  await expect(topic(page, "torch")).toContainText("Needs first: Stats");

  await toggle.getByRole("button", { name: "Graph" }).click();
  await expect(topic(page, "stats")).toBeVisible();
  await expect(list(page)).toHaveCount(0);
});

test("view choice survives reload and a shared link; list selection opens the same panel", async ({
  page,
}) => {
  await page.goto("/roadmap/dev/ml-dev?view=list");
  await expect(list(page)).toBeVisible();
  await page.reload();
  await expect(list(page)).toBeVisible();

  await topic(page, "torch").click();
  const panel = page.getByTestId("topic-panel");
  await expect(panel.getByRole("heading", { name: "Torch" })).toBeVisible();
  await expect(panel.getByText("Frameworks.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Stats" })).toBeVisible();
  await panel.getByRole("button", { name: "Stats" }).click(); // chips navigate inside the list view
  await expect(panel.getByRole("heading", { name: "Stats" })).toBeVisible();
  await expect(topic(page, "stats")).toHaveAttribute("aria-pressed", "true");
});

test("small screens default to the list; an explicit choice wins", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/roadmap/dev/ml-dev");
  await expect(list(page)).toBeVisible();
  await expect(page.locator(".react-flow")).toHaveCount(0);
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Graph" }).click();
  await expect(topic(page, "stats")).toBeVisible();
  await expect(list(page)).toHaveCount(0);
});

test("a failed layout falls back to the list, and the graph can be retried", async ({ page }) => {
  await page.addInitScript(`(() => {
    window.__failWorker = true;
    const Real = window.Worker;
    window.Worker = class extends Real {
      constructor(url, opts) {
        if (window.__failWorker) throw new Error("boom");
        super(url, opts);
      }
    };
  })()`);
  await page.goto("/roadmap/dev/ml-dev");
  await expect(list(page)).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "graph couldn't be drawn" }),
  ).toBeVisible();
  await topic(page, "torch").click();
  await expect(page.getByTestId("topic-panel")).toBeVisible(); // still fully usable

  await page.evaluate("window.__failWorker = false");
  await page.getByRole("button", { name: "Try the graph again" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await expect(list(page)).toHaveCount(0);
});

test("graph: keyboard only. Tab reaches every topic, Enter/Space select, Escape returns focus", async ({
  page,
}) => {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
  await topic(page, "algebra").focus(); // start at the first topic, then walk with Tab only
  const reached = new Set<string>();
  for (let i = 0; i < 30 && reached.size < IDS.length; i++) {
    const id = (await page.evaluate(`document.activeElement?.getAttribute("data-topic-id")`)) as
      string | null;
    if (id) reached.add(id);
    await page.keyboard.press("Tab");
  }
  expect([...reached].sort()).toEqual([...IDS].sort());
  // One tab stop per topic: the node wrapper must not be focusable on top of its button.
  expect(await page.locator(".react-flow__node[tabindex]").count()).toBe(0);

  await topic(page, "stats").focus();
  await page.keyboard.press("Enter");
  await expect(topic(page, "stats")).toHaveAttribute("aria-pressed", "true");
  const panel = page.getByTestId("topic-panel");
  await expect(panel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(topic(page, "stats")).toBeFocused();

  await topic(page, "torch").focus();
  await page.keyboard.press("Space");
  await expect(topic(page, "torch")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(topic(page, "torch")).toBeFocused();
});

test("list: keyboard only. Every topic is reachable, Enter selects, Escape returns focus", async ({
  page,
}) => {
  await page.goto("/roadmap/dev/ml-dev?view=list");
  await expect(list(page)).toBeVisible();
  await topic(page, "algebra").focus();
  const reached = new Set<string>();
  for (let i = 0; i < 30 && reached.size < IDS.length; i++) {
    const id = (await page.evaluate(`document.activeElement?.getAttribute("data-topic-id")`)) as
      string | null;
    if (id) reached.add(id);
    await page.keyboard.press("Tab");
  }
  expect([...reached].sort()).toEqual([...IDS].sort());

  await topic(page, "stats").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("topic-panel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(topic(page, "stats")).toBeFocused();
});

// Axe is deferred (needs an ADR for @axe-core/playwright), so these assert the semantics axe's
// serious/critical rules would catch: names on every control, landmarks, heading order, no
// unlabelled interactive elements. Colour contrast is NOT covered here (see T-012 Findings).
for (const view of ["graph", "list"] as const) {
  test(`${view} view exposes accessible names, landmarks and pressed state`, async ({ page }) => {
    await page.goto(`/roadmap/dev/ml-dev?view=${view}`);
    await expect(topic(page, "stats")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const unnamed = (await page.evaluate(`(() =>
      [...document.querySelectorAll("main button, main select, main a, main input")]
        .filter((e) => {
          const name =
            e.getAttribute("aria-label") ||
            e.getAttribute("title") ||
            e.textContent.trim() ||
            (e.id && document.querySelector('label[for="' + e.id + '"]')?.textContent.trim());
          return !name;
        })
        .map((e) => e.outerHTML.slice(0, 80)))()`)) as string[];
    expect(unnamed).toEqual([]);
    for (const id of IDS) {
      await expect(topic(page, id)).toHaveAttribute("aria-pressed", /true|false/);
      await expect(topic(page, id)).toHaveAccessibleName(/\S/);
    }
    if (view === "list") {
      await expect(page.getByRole("navigation", { name: "Roadmap topics" })).toBeVisible();
      // Heading order: h1 then h2 areas, no skipped level.
      const levels = await page
        .locator("main h1, main h2")
        .evaluateAll((els) => els.map((e) => e.tagName));
      expect(levels[0]).toBe("H1");
      expect(levels.slice(1).every((l) => l === "H2")).toBe(true);
    }
  });
}

test("axe: list view default, topic panel open, covered group shown", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev?view=list");
  await expect(list(page)).toBeVisible();
  await expectNoA11yViolations(page, { label: "list default" });

  await topic(page, "torch").click();
  await expect(page.getByTestId("topic-panel")).toBeVisible();
  await expectNoA11yViolations(page, { label: "list topic selected" });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Show what you already know/ }).click();
  await expect(topic(page, "python")).toBeVisible();
  await expectNoA11yViolations(page, { label: "list covered shown" });
});

test("a covered topic's accessible name includes its Needs first text", async ({ page }) => {
  // The API only returns edges between route topics; add one so a covered topic has a prerequisite.
  await page.route("**/api/roadmap**", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.edges.push({ topicId: "python", prerequisiteId: "stats" });
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/roadmap/dev/ml-dev?view=list");
  await page.getByRole("button", { name: /Show what you already know/ }).click();
  await expect(topic(page, "python")).toHaveAccessibleName(
    /you already know this.*Needs first: Stats/,
  );
});
