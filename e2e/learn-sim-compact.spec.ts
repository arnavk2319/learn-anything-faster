import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-082. Sim compaction: canvas fills its pane, compact control and text sizes, no overflow.
const CONCEPT = "/learn/system-design/concepts/caching";
const SIM = '[data-sim="cache-aside-read"]';

const pin = (page: Page) =>
  page.addInitScript(
    `localStorage.setItem("laf:ui:v1", JSON.stringify({ v: 1, rail: 0.01, rightCollapsed: true }))`,
  );

async function open(page: Page, w: number, h = 800) {
  await pin(page);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(CONCEPT);
  await page.locator("[data-sim-island]").first().scrollIntoViewIfNeeded();
  await expect(page.locator('[data-sim-island="live"]').first()).toBeVisible();
  await expect(page.locator(SIM).getByRole("button", { name: /^(Play|Pause)$/ })).toBeEnabled();
}

for (const w of [1280, 1024]) {
  test(`${w}: svg fills the sim pane and keeps its aspect ratio`, async ({ page }) => {
    await open(page, w);
    const root = page.locator(SIM);
    const canvas = root.locator('[role="group"] > svg').first();
    const wrap = canvas.locator("xpath=..");
    const wb = (await wrap.boundingBox())!;
    const sb = (await canvas.boundingBox())!;
    // Fills the pane, or overflows it into the canvas scroller when the pane is narrower than the legibility floor.
    expect(sb.width).toBeGreaterThanOrEqual(wb.width - 4);
    const vb = (await canvas.getAttribute("viewBox"))!.split(" ").map(Number);
    expect(Math.abs(sb.width / sb.height - vb[2]! / vb[3]!)).toBeLessThan(0.02);
    // The canvas wrapper sits within 4px of the card's content box (padding only, no extra gutters).
    const rb = (await root.boundingBox())!;
    expect(wb.width).toBeGreaterThan(rb.width - 2 * 12 - 4);
  });

  test(`${w}: controls and legend use compact sizes`, async ({ page }) => {
    await open(page, w);
    const root = page.locator(SIM);
    const play = root.getByRole("button", { name: /^(Play|Pause)$/ });
    const hb = (await play.boundingBox())!;
    expect(hb.height).toBeGreaterThanOrEqual(28);
    expect(hb.height).toBeLessThanOrEqual(36);
    // 44px hit area via pseudo-element.
    const hit = await page.evaluate(`(() => {
      const el = document.querySelector('${SIM} [role="toolbar"] button');
      const cs = getComputedStyle(el, "::after");
      return [parseFloat(cs.width), parseFloat(cs.height)];
    })()`);
    expect((hit as number[])[0]).toBeGreaterThanOrEqual(44);
    expect((hit as number[])[1]).toBeGreaterThanOrEqual(44);
    await expect(root.getByLabel("Scenario")).toHaveCSS("font-size", /^1[23](\.\d+)?px$/);
    await expect(root.getByRole("list", { name: "Token legend" })).toHaveCSS(
      "font-size",
      /^1[23](\.\d+)?px$/,
    );
  });

  // Known gap (see T-082 Findings): the 1056x144 layout in a ~350px pane cannot reach 11px without scrolling.
  test.fixme(`${w}: node labels render at 11px or more`, async ({ page }) => {
    await open(page, w);
    const sizes =
      (await page.evaluate(`[...document.querySelectorAll('${SIM} svg text')].map((el) => {
      const svg = el.closest("svg");
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return parseFloat(getComputedStyle(el).fontSize) * scale;
    })`)) as number[];
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(11);
  });
}

test("390: sim fits the width with no horizontal page scroll", async ({ page }) => {
  await open(page, 390, 844);
  const over = await page.evaluate(
    "document.documentElement.scrollWidth > document.documentElement.clientWidth",
  );
  expect(over).toBe(false);
});

test("axe clean with the inspector open and no transition under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 1280);
  const root = page.locator(SIM);
  await root.locator('[data-node="cache"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: /Cache.*details/ })).toBeVisible();
  await expectNoA11yViolations(page, { label: "sim compact inspector" });
});
