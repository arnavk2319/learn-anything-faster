import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-062: the loading skeleton holds the canvas/list footprint, so the page does not jump on load.
test.beforeAll(seedRoadmapFixture);

declare const getComputedStyle: (el: unknown) => { getPropertyValue(p: string): string };
const URL = "/roadmap/dev/ml-dev";

// Holds the roadmap request until release() is called.
async function delayRoadmap(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/roadmap**", async (route) => {
    await gate;
    await route.continue().catch(() => undefined);
  });
  return release;
}

const skeleton = (page: Page) => page.getByRole("status", { name: /loading.*roadmap/i });

for (const w of [375, 768, 1024, 1280]) {
  test(`CLS under 0.1 from skeleton to loaded roadmap at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.addInitScript(`
      window.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    `);
    const release = await delayRoadmap(page);
    await page.goto(URL);
    await expect(skeleton(page)).toBeVisible();
    // Snapshot the shifts caused by page load itself, so only skeleton -> roadmap is measured.
    const before = (await page.evaluate("window.__cls")) as number;
    release();
    await expect(page.locator("button[data-topic-id]").first()).toBeVisible();
    await expect(skeleton(page)).toHaveCount(0);
    await page.waitForTimeout(300);
    const after = (await page.evaluate("window.__cls")) as number;
    expect(after - before).toBeLessThan(0.1);
    if (w === 375) {
      expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
        true,
      );
    }
  });
}

for (const w of [1024, 1280]) {
  test(`skeleton matches the canvas width and min-height at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    const release = await delayRoadmap(page);
    await page.goto(URL);
    const sk = (await skeleton(page).boundingBox())!;
    const main = (await page.getByRole("main").boundingBox())!;
    expect(Math.abs(sk.width - main.width)).toBeLessThanOrEqual(1);
    expect(sk.height).toBeGreaterThanOrEqual(192);
    await expectNoA11yViolations(page, { label: "skeleton loading" });
    release();
    const canvas = page.getByTestId("roadmap-canvas");
    await expect(canvas).toBeVisible();
    const c = (await canvas.boundingBox())!;
    expect(Math.abs(c.width - sk.width)).toBeLessThanOrEqual(1);
    await expectNoA11yViolations(page, { label: "after load" });
  });
}

test("below 640px the skeleton is list-shaped with no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const release = await delayRoadmap(page);
  await page.goto(URL);
  await expect(skeleton(page)).toBeVisible();
  await expect(page.locator('[data-skeleton="list"]')).toBeVisible();
  await expect(page.locator('[data-skeleton="graph"]')).toBeHidden();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
  release();
});

test("at 1024px the skeleton is graph-shaped", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  const release = await delayRoadmap(page);
  await page.goto(URL);
  await expect(page.locator('[data-skeleton="graph"]')).toBeVisible();
  await expect(page.locator('[data-skeleton="list"]')).toBeHidden();
  release();
});

test("reduced motion: skeleton blocks do not animate; normal motion pulses", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const anim = () =>
    page
      .locator('[data-skeleton="graph"] > div > div')
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("animation-name"));
  let release = await delayRoadmap(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(URL);
  await expect(skeleton(page)).toBeVisible();
  expect(await anim()).toContain("pulse");
  release();
  await page.unroute("**/api/roadmap**");

  release = await delayRoadmap(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await expect(skeleton(page)).toBeVisible();
  expect(await anim()).toBe("none");
  release();
});
