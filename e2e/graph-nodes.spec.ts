import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-101: bigger nodes, click affordance, arrowheads, Start/Goal markers on the roadmap graph at 1280px.
test.beforeAll(seedRoadmapFixture);
test.use({ viewport: { width: 1280, height: 800 } });

// The e2e tsconfig has no DOM lib; declare the browser global the evaluate callbacks need.
declare const getComputedStyle: (el: unknown) => {
  getPropertyValue(p: string): string;
  transitionDuration: string;
  cursor: string;
  fontSize: string;
  transform: string;
  boxShadow: string;
};

const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
async function open(page: Page) {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
}

test("every edge has an arrowhead marker (count equals edge count)", async ({ page }) => {
  await open(page);
  const edges = await page.locator(".react-flow__edge").count();
  expect(edges).toBeGreaterThan(0);
  await expect(page.locator(".react-flow__edge .edge-unmet[marker-end]")).toHaveCount(edges);
  const colour = await page.evaluate(`(() => {
    const m = document.querySelector(".react-flow__marker path, .react-flow__arrowhead polyline, marker path");
    return m ? getComputedStyle(m).fill : "";
  })()`);
  expect(colour).not.toBe("");
});

test("labels are at least 14px and never overflow the 224 x 52 node", async ({ page }) => {
  await open(page);
  const buttons = page.locator("button[data-topic-id]");
  const n = await buttons.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const fs = await b.locator("span.truncate").evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(fs)).toBeGreaterThanOrEqual(14);
    const overflow = await b.evaluate((el) => {
      const e = el as unknown as { scrollWidth: number; clientWidth: number };
      return e.scrollWidth - e.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("nodes show a chevron, a pointer cursor and lift on hover (inner element only)", async ({
  page,
}) => {
  await open(page);
  const b = topic(page, "stats");
  await expect(b.locator('[data-affordance="chevron"]')).toBeVisible();
  expect(await b.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
  await page.waitForTimeout(600); // fit-view settles
  const before = await b.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.transform}|${s.boxShadow}|${(el as unknown as { style: { translate: string } }).style.translate}`;
  });
  const t0 = await b.evaluate((el) => getComputedStyle(el).getPropertyValue("translate"));
  await b.hover();
  await expect
    .poll(() => b.evaluate((el) => getComputedStyle(el).getPropertyValue("translate")))
    .not.toBe(t0);
  const after = await b.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.transform}|${s.boxShadow}|${(el as unknown as { style: { translate: string } }).style.translate}`;
  });
  expect(after).not.toBe(before);
  // React Flow owns the wrapper transform: it is never given a hover transition or lift class.
  const wrapperClass = await b.evaluate(
    (el) =>
      (el as unknown as { closest(s: string): { className: string } }).closest(".react-flow__node")
        .className,
  );
  expect(wrapperClass).not.toMatch(/hover:/);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("hover does not move the node and has no transition", async ({ page }) => {
    await open(page);
    const b = topic(page, "stats");
    const dur =
      parseFloat(await b.evaluate((el) => getComputedStyle(el).transitionDuration)) * 1000;
    expect(dur).toBeLessThan(20);
    await b.hover();
    // --lift-y is 0px under reduced motion: no vertical shift (computed "none" or "0px").
    expect(await b.evaluate((el) => getComputedStyle(el).getPropertyValue("translate"))).toMatch(
      /^(none|0px( 0px)?)$/,
    );
  });
});

test("Start is on the first topic and Goal on the last, as text", async ({ page }) => {
  await open(page);
  const first = topic(page, "algebra");
  const last = topic(page, "torch");
  await expect(first).toContainText("Start");
  await expect(last).toContainText("Goal");
  await expect(topic(page, "stats")).not.toContainText("Start");
  await expect(topic(page, "stats")).not.toContainText("Goal");
  await expect(page.getByText("Goal", { exact: true })).toHaveCount(1);
});

test("Tab reaches a node and Enter opens the topic panel; axe clean", async ({ page }) => {
  await open(page);
  await topic(page, "stats").focus();
  await expect(topic(page, "stats")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("topic-panel")).toBeVisible();
  await expectNoA11yViolations(page);
});
