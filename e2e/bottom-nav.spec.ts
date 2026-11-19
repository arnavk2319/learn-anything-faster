import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

declare const getComputedStyle: (el: unknown) => {
  transitionDuration: string;
  animationDuration: string;
};
// T-093: shared mobile bottom nav on the roadmap page and /roadmaps (below 768px only).
test.beforeAll(seedRoadmapFixture);

const PAGES = [
  { name: "roadmap", url: "/roadmap/dev/ml-dev?view=list", label: "Roadmap views", items: 3 },
  { name: "browse", url: "/roadmaps", label: "Browse", items: 2 },
] as const;

const nav = (page: Page, label: string) => page.getByRole("navigation", { name: label });
const noOverflow = (page: Page) =>
  page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth");

for (const p of PAGES) {
  for (const w of [320, 375]) {
    test(`${p.name}: nav visible, 44px items, no overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(p.url);
      const n = nav(page, p.label);
      await expect(n).toBeVisible();
      const items = n.locator("a, button");
      await expect(items).toHaveCount(p.items);
      for (const box of await items.all()) {
        expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await noOverflow(page)).toBe(true);
    });
  }

  test(`${p.name}: hidden at 768px and wider`, async ({ page }) => {
    for (const w of [768, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(p.url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const sel = page.locator(`nav[aria-label="${p.label}"]`);
      await expect(sel).toHaveCount(1);
      await expect(sel).toBeHidden();
    }
  });

  test(`${p.name}: landmark, aria-current, Tab order content then nav`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(p.url);
    const n = nav(page, p.label);
    await expect(n.locator("[aria-current]")).toHaveCount(1);
    // Every other landmark label is different from this one.
    await expect(page.getByRole("navigation", { name: p.label, exact: true })).toHaveCount(1);
    const order = (await page.evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="${p.label}"]');
      const all = [...document.querySelectorAll("a[href], button:not([disabled]), select, [tabindex='0']")]
        .filter((e) => e.getClientRects().length > 0);
      const idx = all.findIndex((e) => nav.contains(e));
      return { idx, afterAreNav: all.slice(idx).every((e) => nav.contains(e)), total: all.length };
    })()`)) as { idx: number; afterAreNav: boolean; total: number };
    expect(order.idx).toBeGreaterThan(0);
    expect(order.afterAreNav).toBe(true);
  });

  test(`${p.name}: axe clean at 375px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(p.url);
    await expect(nav(page, p.label)).toBeVisible();
    await expectNoA11yViolations(page, { label: `${p.name} bottom nav` });
  });

  test(`${p.name}: reduced motion gives zero durations on the nav (global rule: 0.01ms)`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(p.url);
    const d = (await nav(page, p.label)
      .locator("a, button")
      .evaluateAll(
        (els) =>
          els.flatMap((e) => {
            const s = getComputedStyle(e);
            return [s.transitionDuration, s.animationDuration];
          }) as string[],
      )) as string[];
    for (const v of d) expect(v.split(",").every((x) => parseFloat(x) <= 0.00001)).toBe(true);
  });
}

test("roadmap: nav switches view and Topic is disabled with a reason until a topic is selected", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/roadmap/dev/ml-dev?view=list");
  const n = nav(page, "Roadmap views");
  const topicBtn = n.getByRole("button", { name: /Topic/ });
  await expect(topicBtn).toHaveAttribute("aria-disabled", "true");
  await expect(topicBtn).toContainText("Select a topic first");
  await n.getByRole("link", { name: "Graph" }).click();
  await expect(page).toHaveURL(/view=graph/);
  await expect(n.getByRole("link", { name: "Graph" })).toHaveAttribute("aria-current", "true");
});

test("roadmap: sheet and its close button are fully visible and clickable with the nav present; axe clean", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/roadmap/dev/ml-dev?view=list");
  await page.locator("button[data-topic-id]").first().click();
  const sheet = page.getByTestId("topic-panel");
  await expect(sheet).toBeVisible();
  await expect(nav(page, "Roadmap views")).toBeVisible();
  const sb = (await sheet.boundingBox())!;
  expect(sb.y).toBeGreaterThanOrEqual(0);
  expect(Math.round(sb.y + sb.height)).toBeLessThanOrEqual(800);
  const close = sheet.getByRole("button", { name: "Close panel" });
  const cb = (await close.boundingBox())!;
  // The sheet sits above the nav: the topmost element at the close button and the sheet's bottom edge is the sheet.
  for (const [x, y] of [
    [cb.x + cb.width / 2, cb.y + cb.height / 2],
    [sb.x + sb.width / 2, sb.y + sb.height - 2],
  ] as const) {
    const inSheet = await page.evaluate(
      `!!document.elementFromPoint(${x}, ${y})?.closest('[data-testid="topic-panel"]')`,
    );
    expect(inSheet).toBe(true);
  }
  expect(await noOverflow(page)).toBe(true);
  await expectNoA11yViolations(page, { label: "roadmap sheet open with nav" });
  await close.click();
  await expect(sheet).toHaveCount(0);
  await expect(nav(page, "Roadmap views")).toBeVisible();
});

test("roadmap: nav does not cover the toolbar or Start button (graph view)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/roadmap/dev/ml-dev?view=graph");
  const n = nav(page, "Roadmap views");
  const nb = (await n.boundingBox())!;
  const start = page.getByRole("button", { name: /^Start with/ });
  await expect(start).toBeVisible();
  const sb = (await start.boundingBox())!;
  expect(sb.y + sb.height).toBeLessThanOrEqual(nb.y);
  const main = (await page.getByRole("main").boundingBox())!;
  expect(main.y + main.height).toBeLessThanOrEqual(nb.y + 1);
});

test("learn: bottom nav DOM and items are unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/learn/system-design/concepts/caching");
  const n = nav(page, "Sections");
  await expect(n).toBeVisible();
  const html = await n.evaluate((e) => e.outerHTML);
  expect(html).toMatch(/^<nav aria-label="Sections" class="[^"]*md:hidden">/);
  const btns = n.locator("> button");
  await expect(btns).toHaveText(["Outline", "Content", "Next"]);
  await expect(btns.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(n.locator("[aria-current]")).toHaveCount(0);
  await btns.nth(2).focus();
  await btns.nth(2).press("Enter");
  await expect(btns.nth(2)).toHaveAttribute("aria-pressed", "true");
});

test("landing has no bottom nav", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const l of ["Roadmap views", "Browse", "Sections"])
    await expect(nav(page, l)).toHaveCount(0);
});
