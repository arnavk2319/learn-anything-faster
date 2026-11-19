import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-100: below 768px the graph is not mounted and the numbered pathway list is the only view.
test.beforeAll(seedRoadmapFixture);

const URL = "/roadmap/dev/ml-dev";
const rows = (page: Page) => page.locator("[data-testid='roadmap-list'] button[data-topic-id]");
const noOverflow = (page: Page) =>
  page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth");

test("375px: no canvas, no ELK worker, one row per topic in API order", async ({ page }) => {
  await page.addInitScript(`(() => {
    window.__workers = 0;
    const Real = window.Worker;
    window.Worker = class extends Real { constructor(u, o) { super(u, o); window.__workers++; } };
  })()`);
  await page.setViewportSize({ width: 375, height: 800 });
  const apiP = page.waitForResponse((r) => r.url().includes("/api/roadmap") && r.ok());
  await page.goto(URL);
  const api = (await (await apiP).json()) as { nodes: { id: string }[] };
  await expect(rows(page)).toHaveCount(api.nodes.length);
  const ids = await rows(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-topic-id")),
  );
  expect(ids).toEqual(api.nodes.map((n) => n.id));
  const steps = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-step")));
  expect(steps).toEqual(api.nodes.map((_, i) => String(i + 1)));
  await expect(page.locator(".react-flow")).toHaveCount(0);
  expect(await page.evaluate("window.__workers")).toBe(0);
  await expect(page.getByRole("group", { name: "View" })).toHaveCount(0);
  for (const box of await rows(page).all())
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(56);
});

for (const w of [320, 375]) {
  test(`${w}px: row opens the sheet, Start here and covered render, no overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(`${URL}?view=graph`); // ?view is ignored below 768px
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator(".react-flow")).toHaveCount(0);
    await expect(rows(page).first()).toContainText("Start here");
    await page.getByRole("button", { name: /Show what you already know/ }).click();
    await expect(page.locator("button[data-topic-id='python']")).toHaveAccessibleName(
      /you already know this/,
    );
    expect(await noOverflow(page)).toBe(true);
    await rows(page).first().click();
    await expect(page.getByTestId("topic-panel")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await expectNoA11yViolations(page, { label: `roadmap mobile list ${w}` });
  });
}

test("resizing across 768px swaps list and graph, keeps the selection, no console error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(URL);
  await page.locator("button[data-topic-id='stats']").click();
  await expect(page.getByTestId("topic-panel")).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator(".react-flow")).toHaveCount(1);
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(
    page.getByTestId("topic-panel").getByRole("heading", { name: "Stats" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator(".react-flow")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "View" })).toHaveCount(0);
  await expect(page.locator("button[data-topic-id='stats']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

test("desktop 1280px: graph and toggle unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL);
  await expect(page.locator(".react-flow")).toHaveCount(1);
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
});
