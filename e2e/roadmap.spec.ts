import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
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

const viewportTransform = (page: Page) =>
  page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as unknown as { style: { transform: string } }).style.transform);
const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);

test("graph renders areas and topics, selects by click and by keyboard", async ({ page }) => {
  const t0 = Date.now();
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(5000); // loose CI bound; about 1s locally
  await expect(page.getByRole("button", { name: /^Math, 2 topics/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Deep, 1 topic/ })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  await topic(page, "algebra").click();
  await expect(topic(page, "algebra")).toHaveAttribute("aria-pressed", "true");
  await topic(page, "stats").click();
  await expect(topic(page, "stats")).toHaveAttribute("aria-pressed", "true");
  await expect(topic(page, "algebra")).toHaveAttribute("aria-pressed", "false"); // one at a time

  // Keyboard: Tab onto a topic, Enter selects it.
  await topic(page, "torch").focus();
  await page.keyboard.press("Enter");
  await expect(topic(page, "torch")).toHaveAttribute("aria-pressed", "true");
});

test("pan, zoom and fit", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
  const before = await viewportTransform(page);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => viewportTransform(page)).not.toBe(before);
  const zoomed = await viewportTransform(page);

  const box = (await page.getByTestId("roadmap-canvas").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + box.height - 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 85, box.y + box.height - 45, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => viewportTransform(page)).not.toBe(zoomed);

  await page.getByRole("button", { name: "Fit" }).click();
  await expect.poll(() => viewportTransform(page)).not.toBe(zoomed);
});

test("areas collapse and expand; covered topics can be shown", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  const math = page.getByRole("button", { name: /^Math, 2 topics/ });
  await expect(math).toHaveAttribute("aria-expanded", "true");
  await math.click();
  await expect(math).toHaveAttribute("aria-expanded", "false");
  await expect(topic(page, "stats")).toHaveCount(0);
  await expect(topic(page, "torch")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1); // re-routed to the lane
  await math.click();
  await expect(topic(page, "stats")).toBeVisible();

  await page.getByRole("button", { name: /Show what you already know \(1\)/ }).click();
  await expect(topic(page, "python")).toBeVisible();
  await page.getByRole("button", { name: "Hide what you know" }).click();
  await expect(topic(page, "python")).toHaveCount(0);
});

test("changing a role refetches and re-renders without a reload", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "algebra")).toBeVisible();
  await page.evaluate("window.__noReload = true");
  await page.getByLabel("Current role").selectOption("dev2");
  await expect(page).toHaveURL(/\/roadmap\/dev2\/ml-dev$/);
  await expect(topic(page, "stats")).toBeVisible();
  await expect(topic(page, "algebra")).toHaveCount(0); // dev2 covers it
  expect(await page.evaluate("window.__noReload === true")).toBe(true);
});

test("uncurated pair shows the not-mapped state", async ({ page }) => {
  await page.goto("/roadmap/dev/later-role");
  await expect(page.getByText("Developer to Later isn't mapped yet.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Request this move" })).toBeVisible();
});

test("error state offers a retry", async ({ page }) => {
  let fail = true;
  await page.route("**/api/roadmap**", (route) =>
    fail ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.continue(),
  );
  await page.goto("/roadmap/dev/ml-dev");
  await expect(page.getByText("We couldn't load this roadmap.")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(topic(page, "stats")).toBeVisible();
});

test("@smoke topic panel opens with why, resources and suggest form", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  await topic(page, "torch").click();
  const panel = page.getByTestId("topic-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Torch" })).toBeVisible();
  await expect(panel.getByText("Frameworks.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Stats" })).toBeVisible(); // Needs first chip
  await panel.locator("summary", { hasText: "Suggest a resource" }).click();
  await expect(panel.getByRole("form", { name: "Suggest a resource" })).toBeVisible();
});

test("topic panel: resource link opens safely, Escape closes and returns focus", async ({
  page,
}) => {
  await page.goto("/roadmap/dev/ml-dev");
  await topic(page, "torch").focus();
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("topic-panel");
  await expect(panel).toBeFocused();
  const link = panel.getByRole("link", { name: /torch docs/ });
  await expect(link).toHaveAttribute("href", "https://example.com/torch");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toContainText("Free");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(topic(page, "torch")).toBeFocused();
});

test("topic panel shows the empty-resources state", async ({ page }) => {
  await page.route("**/api/roadmap**", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    for (const n of json.nodes) n.resources = [];
    await route.fulfill({ response: res, json });
  });
  await page.goto("/roadmap/dev/ml-dev");
  await topic(page, "stats").click();
  await expect(
    page.getByTestId("topic-panel").getByText(/No approved resources yet/),
  ).toBeVisible();
});

test.describe("share link (F6)", () => {
  test("both URL forms load the same graph cold", async ({ page }) => {
    await page.goto("/roadmap/dev/ml-dev");
    await expect(topic(page, "stats")).toBeVisible();
    const count = await page.locator("button[data-topic-id]").count();
    await page.goto("/roadmap?from=dev&to=ml-dev");
    await expect(page).toHaveURL(/\/roadmap\/dev\/ml-dev$/);
    await expect(topic(page, "stats")).toBeVisible();
    await expect(page.locator("button[data-topic-id]")).toHaveCount(count);
  });

  test("role change updates the URL in place without a reload", async ({ page }) => {
    await page.goto("/roadmap/dev/ml-dev");
    await expect(topic(page, "algebra")).toBeVisible();
    await page.evaluate("window.__noReload = true");
    await page.getByLabel("Current role").selectOption("dev2");
    await expect(page).toHaveURL(/\/roadmap\/dev2\/ml-dev$/);
    await expect(topic(page, "algebra")).toHaveCount(0);
    expect(await page.evaluate("window.__noReload === true")).toBe(true);
  });

  test("copy link copies the canonical URL and confirms", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/roadmap?from=dev&to=ml-dev");
    await expect(topic(page, "stats")).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    const origin = new URL(page.url()).origin;
    expect(baseURL).toBeTruthy();
    expect(await page.evaluate("navigator.clipboard.readText()")).toBe(
      `${origin}/roadmap/dev/ml-dev`,
    );
  });

  test("falls back to a selectable field when the clipboard rejects", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
    await page.goto("/roadmap/dev/ml-dev");
    await expect(topic(page, "stats")).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByLabel("Roadmap link")).toHaveValue(/\/roadmap\/dev\/ml-dev$/);
  });
});
