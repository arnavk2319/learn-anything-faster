import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-080. Concept and problem page layout inside the T-079 shell: sticky sim beside text, compact tier,
// in-page outline (right rail, "On this page"), inspector in the right rail.
const CONCEPT = "/learn/system-design/concepts/caching";
const PROBLEM = "/learn/system-design/problems/url-shortener";
const NO_SIM = "/learn/system-design/concepts/long-label-fixture";

// The fixture track has one very long outline label, so the T-079 default (full labels) makes the rail ~750px.
// These tests pin the rail to its minimum, as a user would. At 1280 that still leaves a narrow main column, so
// only the overflow test keeps the right rail open (worst case); the rest collapse it for a representative width.
const pin = (page: Page, rightCollapsed: boolean) =>
  page.addInitScript(
    `localStorage.setItem("laf:ui:v1", JSON.stringify({ v: 1, rail: 0.01, rightCollapsed: ${rightCollapsed} }))`,
  );
test.beforeEach(({ page }) => pin(page, true));

// Navigate and wait for hydration to apply the pinned rail width.
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect
    .poll(() => page.getByTestId("outline-rail").evaluate((el) => el.getBoundingClientRect().width))
    .toBeLessThan(600);
}

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const scrollMain = (page: Page, y: number) =>
  page.evaluate(`document.querySelector("#main-content").scrollTop = ${y}`);
// Elements poking past the main column, ignoring those inside a horizontally scrollable region (own scroller).
const overflowing = (page: Page) =>
  page.evaluate(`(() => {
    const m = document.querySelector("#main-content");
    const right = m.getBoundingClientRect().right + 1;
    const bad = [...m.querySelectorAll("*")].filter(
      (el) => !el.closest(".overflow-x-auto") && !el.closest("svg") && el.getBoundingClientRect().right > right,
    ).map((el) => el.tagName + "." + String(el.className).slice(0, 40));
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) bad.push("PAGE");
    if (m.scrollWidth > m.clientWidth) bad.push("MAIN");
    return bad;
  })()`);

for (const url of [CONCEPT, PROBLEM]) {
  test.describe(`layout ${url.split("/").at(-1)}`, () => {
    test("1280: sim beside text and sticky after scrolling 2000px", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, url);
      const [t, s] = [
        await box(page, '[data-testid="item-text"]'),
        await box(page, '[data-testid="item-sim"]'),
      ];
      expect(s.x).toBeGreaterThan(t.x + t.width - 1);
      await scrollMain(page, 2000);
      await page.waitForTimeout(200);
      const after = await box(page, '[data-testid="item-sim"]');
      expect(after.y).toBeGreaterThanOrEqual(0);
      expect(after.y).toBeLessThanOrEqual(120);
      expect(
        await page.evaluate('document.querySelector("#main-content").scrollTop'),
      ).toBeGreaterThan(500);
    });

    test("1024 beside, 900 stacked after the text, 390 one pane", async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await open(page, url);
      let t = await box(page, '[data-testid="item-text"]');
      let s = await box(page, '[data-testid="item-sim"]');
      expect(s.x).toBeGreaterThan(t.x + t.width - 1);
      await page.setViewportSize({ width: 900, height: 800 });
      t = await box(page, '[data-testid="item-text"]');
      s = await box(page, '[data-testid="item-sim"]');
      expect(s.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
      await page.setViewportSize({ width: 390, height: 800 });
      t = await box(page, '[data-testid="item-text"]');
      s = await box(page, '[data-testid="item-sim"]');
      expect(s.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
      await expect(page.getByTestId("outline-rail")).toBeHidden(); // one pane
      expect(await overflowing(page)).toEqual([]);
    });

    test("compact tier: body 14px, h1 24-28px, h2 17-20px", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, url);
      const px = (sel: string) =>
        page.evaluate(
          `parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(sel)})).fontSize)`,
        ) as Promise<number>;
      expect(await px('[data-testid="item-text"] p')).toBe(14);
      const h1 = await px("#main-content h1");
      expect(h1).toBeGreaterThanOrEqual(24);
      expect(h1).toBeLessThanOrEqual(28);
      const h2 = await px("#main-content h2");
      expect(h2).toBeGreaterThanOrEqual(17);
      expect(h2).toBeLessThanOrEqual(20);
    });

    for (const width of [1280, 390]) {
      test(`no horizontal overflow at ${width}`, async ({ page }) => {
        await pin(page, false);
        await page.setViewportSize({ width, height: 800 });
        await open(page, url);
        expect(await overflowing(page)).toEqual([]);
        // Each block type present on the page stays inside the main column.
        const main = await box(page, "#main-content");
        for (const sel of ["table", "details", "pre", "form, [role=radiogroup], fieldset"]) {
          for (const el of await page.locator(`[data-testid="item-text"] ${sel}`).all()) {
            const b = await el.boundingBox();
            if (b) expect(b.x + b.width).toBeLessThanOrEqual(main.x + main.width + 1);
          }
        }
      });
    }

    test("axe clean at 1280 and 390", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, url);
      await expectNoA11yViolations(page, { label: `layout ${url} 1280` });
      await page.setViewportSize({ width: 390, height: 800 });
      await expectNoA11yViolations(page, { label: `layout ${url} 390` });
    });

    test("keyboard order: outline, text, sim, right rail", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, url);
      const order = await page.evaluate(`(() => {
        const q = (s) => document.querySelector(s);
        const regions = [q("[data-testid=outline-rail]"), q("[data-testid=item-text]"), q("[data-testid=item-sim]"), q("[data-testid=right-rail]")];
        return regions.slice(1).every((el, i) => !!(regions[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      })()`);
      expect(order).toBe(true);
    });
  });
}

test("outline: scroll-spy highlights the current heading; click scrolls and focuses it", async ({
  page,
}) => {
  await pin(page, false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, CONCEPT);
  const nav = page.getByRole("navigation", { name: "On this page" });
  await expect(nav).toBeVisible();
  await expect(nav.locator('[aria-current="location"]')).toContainText("Caching");
  await nav.getByRole("link", { name: "Advanced" }).click();
  const h = page.locator("#advanced-h");
  await expect(h).toBeFocused();
  expect((await h.boundingBox())!.y).toBeLessThan(200);
  await expect(nav.locator('[aria-current="location"]')).toContainText("Advanced");
  await scrollMain(page, 0);
  await expect(nav.locator('[aria-current="location"]')).toContainText("Caching");
  await scrollMain(page, 1);
  await nav.getByRole("link", { name: "Intermediate" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#intermediate-h")).toBeFocused();
  await expectNoA11yViolations(page, { label: "layout on this page" });
});

test("text-only fixture without a sim uses the full width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, NO_SIM);
  await expect(page.getByTestId("item-sim")).toHaveCount(0);
  const b = await box(page, '[data-testid="item-text"]');
  const m = await box(page, "#main-content");
  expect(b.width).toBeGreaterThan(400);
  expect(b.x + b.width).toBeLessThanOrEqual(m.x + m.width);
  expect(await overflowing(page)).toEqual([]);
  await expectNoA11yViolations(page, { label: "layout no-sim 1280" });
});

test("inspector renders in the right rail inside the shell; Escape closes and returns focus", async ({
  page,
}) => {
  await pin(page, false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, CONCEPT);
  const root = page.locator('[data-sim="cache-aside-read"]');
  await expect(page.locator('[data-sim-island="live"]')).toBeVisible();
  await root.getByRole("button", { name: "Pause" }).click();
  const node = root.locator('[data-node="cache"]');
  await node.focus();
  await page.keyboard.press("Enter");
  const slot = page.locator('[data-shell-slot="inspector"]');
  const panel = slot.getByRole("region", { name: /Cache.*details/ });
  await expect(panel).toBeVisible();
  await expect(root.getByRole("complementary")).toHaveCount(0);
  await expect(slot.getByRole("button", { name: "Close" })).toBeFocused();
  await expectNoA11yViolations(page, { label: "layout inspector in rail" });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(node).toBeFocused();
});
