import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-086: the roadmap uses the v2 compact shell and fills the viewport.
test.beforeAll(seedRoadmapFixture);

// The e2e tsconfig has no DOM lib; declare the one browser global the evaluate callbacks need.
declare const getComputedStyle: (el: unknown) => { getPropertyValue(p: string): string };
const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const URL = "/roadmap/dev/ml-dev";
const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);

test.describe("desktop 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("48px header, no page scroll, canvas fills main", async ({ page }) => {
    await page.goto(URL);
    await expect(topic(page, "stats")).toBeVisible();
    await expect(page.locator('[data-ui="v2"][data-density="compact"]')).toHaveCount(1);
    const header = (await page.getByRole("banner").boundingBox())!;
    expect(Math.round(header.height)).toBe(48);
    const noScroll = await page.evaluate(
      "document.documentElement.scrollHeight <= window.innerHeight",
    );
    expect(noScroll).toBe(true);
    const main = (await page.getByRole("main").boundingBox())!;
    const canvas = (await page.getByTestId("roadmap-canvas").boundingBox())!;
    expect(Math.abs(canvas.x - main.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(canvas.x + canvas.width - (main.x + main.width))).toBeLessThanOrEqual(4);
    expect(Math.abs(canvas.y + canvas.height - (main.y + main.height))).toBeLessThanOrEqual(4);
    expect(canvas.height).toBeGreaterThan(main.height * 0.6);
  });

  test("summary and Start with stay visible; skip link, landmarks, axe", async ({ page }) => {
    await page.goto(URL);
    await expect(topic(page, "stats")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start with / })).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByText(/topics?/)
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    for (const name of ["Current role", "Target role"])
      await expect(page.getByRole("combobox", { name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Roadmap canvas" })).toBeVisible();
    await expectNoA11yViolations(page, { label: "roadmap desktop" });
  });

  test("topic opens in a right rail beside the canvas; closing returns focus", async ({ page }) => {
    await page.goto(URL);
    await topic(page, "torch").click();
    const panel = page.getByTestId("topic-panel");
    await expect(panel).toBeVisible();
    const p = (await panel.boundingBox())!;
    const main = (await page.getByRole("main").boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(main.x + main.width - 4); // beside main, not over it
    expect(await style(panel, "position")).toBe("static");
    await panel.getByRole("button", { name: "Close panel" }).click();
    await expect(panel).toHaveCount(0);
    await expect(topic(page, "torch")).toBeFocused();
  });

  test("list view toggle still works", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: "List" }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByTestId("roadmap-canvas")).toHaveCount(0);
  });

  test("reduced motion: rail has no transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    await topic(page, "torch").click();
    const d = await style(page.getByTestId("topic-panel"), "transition-duration");
    expect(d.split(",").every((x: string) => parseFloat(x) < 0.001)).toBe(true);
  });
});

test.describe("mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("summary and Start with visible; topic is a bottom sheet; axe", async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByRole("button", { name: /^Start with / })).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByText(/topics?/)
        .first(),
    ).toBeVisible();
    await expectNoA11yViolations(page, { label: "roadmap mobile" });
    await page.getByRole("button", { name: "Graph" }).click();
    await topic(page, "torch").click();
    const panel = page.getByTestId("topic-panel");
    await expect(panel).toBeVisible();
    expect(await style(panel, "position")).toBe("fixed");
    const b = (await panel.boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(844);
  });
});
