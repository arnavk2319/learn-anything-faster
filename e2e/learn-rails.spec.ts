import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-098. Learn rails: one sidebar-toggle icon per rail, persisted collapse, 44px rows, reflow.
const CONCEPT = "/learn/system-design/concepts/caching";
const OTHER = "/learn/system-design/concepts/long-label-fixture";
const KEY = "laf:ui:v1";

const left = (p: Page) => p.getByRole("button", { name: /^(Collapse|Expand) outline$/ });
const right = (p: Page) => p.getByRole("button", { name: /^(Collapse|Expand) page outline$/ });
const width = (p: Page, id: string) =>
  p.getByTestId(id).evaluate((el) => el.getBoundingClientRect().width);
async function settle(p: Page) {
  await expect(left(p)).toBeVisible();
  await p.evaluate("document.fonts.ready.then(() => true)");
}

test.describe("learn rails, desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("toggles are focusable, work on Enter and Space, aria-expanded matches", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    await settle(page);
    for (const [btn, id] of [
      [left, "outline-rail"],
      [right, "right-rail"],
    ] as const) {
      const b = btn(page);
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(b).toHaveAttribute("aria-expanded", "true");
      await expect(b).toHaveAttribute("aria-controls", /.+/);
      await b.focus();
      await page.keyboard.press("Enter");
      await expect(b).toHaveAttribute("aria-expanded", "false");
      await expect.poll(() => width(page, id)).toBe(44);
      await page.keyboard.press("Space");
      await expect(b).toHaveAttribute("aria-expanded", "true");
      await expect.poll(() => width(page, id)).toBeGreaterThan(100);
    }
    await expect(page.getByRole("button", { name: /Hide|Show/ })).toHaveCount(0);
  });

  test("collapsed rails keep the icon, hide the body and free width for main", async ({ page }) => {
    await page.goto(CONCEPT);
    await settle(page);
    const main = page.locator("main#main-content");
    const before = (await main.boundingBox())!.width;
    await left(page).click();
    await right(page).click();
    await expect.poll(() => width(page, "outline-rail")).toBe(44);
    await expect.poll(() => width(page, "right-rail")).toBe(44);
    expect((await main.boundingBox())!.width).toBeGreaterThan(before + 300);
    await expect(page.getByRole("button", { name: "Expand outline" })).toBeVisible();
    await expect(page.getByRole("separator", { name: "Resize outline" })).toHaveCount(0);
    await expect(page.getByTestId("outline-rail").getByRole("link")).toHaveCount(0);
    await expectNoA11yViolations(page, { label: "rails collapsed" });
    await left(page).click();
    await right(page).click();
    await expectNoA11yViolations(page, { label: "rails expanded" });
  });

  test("collapse state survives reload and navigation between concepts", async ({ page }) => {
    await page.goto(CONCEPT);
    await settle(page);
    await left(page).click();
    await right(page).click();
    await page.reload();
    await expect(left(page)).toHaveAttribute("aria-expanded", "false");
    await expect(right(page)).toHaveAttribute("aria-expanded", "false");
    await page.goto(OTHER);
    await expect(left(page)).toHaveAttribute("aria-expanded", "false");
    await expect(right(page)).toHaveAttribute("aria-expanded", "false");
    const stored = JSON.parse((await page.evaluate(`localStorage.getItem("${KEY}")`)) as string);
    expect(stored).toMatchObject({ v: 1, leftCollapsed: true, rightCollapsed: true });
    await page.evaluate(`localStorage.setItem("${KEY}", '{"v":1,"leftCollapsed":"x"}')`);
    await page.reload();
    await expect(left(page)).toHaveAttribute("aria-expanded", "true");
  });

  test("every outline and right-rail row is at least 44px tall", async ({ page }) => {
    await page.goto(CONCEPT);
    await settle(page);
    const rows = page.locator(
      "[data-testid=outline-rail] #left-rail-body a, [data-testid=right-rail] #right-rail-body a",
    );
    expect(await rows.count()).toBeGreaterThan(3);
    for (const box of await rows.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    ))
      expect(box).toBeGreaterThanOrEqual(44);
  });

  test("reduced motion: no transitions on the rails", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(CONCEPT);
    await settle(page);
    const durs =
      (await page.evaluate(`["[data-testid=outline-rail]", "[data-testid=right-rail]"].map(
      (s) => getComputedStyle(document.querySelector(s)).transitionDuration,
    )`)) as string[];
    for (const d of durs)
      expect(d.split(",").every((x: string) => parseFloat(x) < 0.001)).toBe(true);
  });
});

for (const w of [1024, 1280, 1440]) {
  test.describe(`learn rails overflow at ${w}`, () => {
    test.use({ viewport: { width: w, height: 800 } });
    test("no horizontal overflow expanded or collapsed", async ({ page }) => {
      await page.goto(CONCEPT);
      await settle(page);
      const over = () => page.evaluate("document.documentElement.scrollWidth <= window.innerWidth");
      expect(await over()).toBe(true);
      await left(page).click();
      if (w >= 1024) await right(page).click();
      expect(await over()).toBe(true);
    });
  });
}

test.describe("learn rails, narrow", () => {
  test.use({ viewport: { width: 700, height: 800 } });
  test("no toggle icons below 768px", async ({ page }) => {
    await page.goto(CONCEPT);
    await expect(page.getByRole("button", { name: "Content" })).toBeVisible();
    await expect(left(page)).toHaveCount(0);
  });
});
