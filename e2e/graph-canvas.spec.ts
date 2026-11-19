import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-102: warm canvas background, first-visit hint, floating toolbar and minimap on the desktop roadmap graph.
test.beforeAll(seedRoadmapFixture);
test.use({ viewport: { width: 1280, height: 800 } });

// The e2e tsconfig has no DOM lib; declare the browser globals the evaluate callbacks need.
declare const getComputedStyle: (el: unknown) => {
  getPropertyValue(p: string): string;
  backgroundColor: string;
  backgroundImage: string;
  cursor: string;
  transitionDuration: string;
  animationName: string;
};

const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
const hint = (page: Page) => page.getByTestId("canvas-hint");
const transform = (page: Page) =>
  page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as unknown as { style: { transform: string } }).style.transform);
const scale = async (page: Page) => {
  const m = /scale\(([\d.]+)\)/.exec(await transform(page));
  return m ? Number(m[1]) : NaN;
};
const css = (loc: Locator, prop: "backgroundColor" | "backgroundImage" | "cursor") =>
  loc.evaluate((el, p) => getComputedStyle(el)[p as "cursor"], prop);

async function open(page: Page) {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
  let prev = "";
  await expect
    .poll(async () => {
      const cur = await transform(page);
      const same = cur === prev;
      prev = cur;
      return same;
    })
    .toBe(true);
}
const paneCentre = async (page: Page) => {
  const r = (await page.locator(".react-flow__pane").boundingBox())!;
  return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.95 };
};

test("canvas background is token based, not the React Flow default", async ({ page }) => {
  await open(page);
  const canvas = page.getByTestId("roadmap-canvas");
  // Resolve the token inside the canvas: --canvas differs inside the v2 shell scope.
  const token = (await page.evaluate(`(() => {
    const d = document.createElement("div");
    d.style.backgroundColor = "var(--canvas)";
    document.querySelector("[data-testid=roadmap-canvas]").append(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  })()`)) as string;
  expect(await css(canvas, "backgroundColor")).toBe(token);
  expect(token).not.toBe("rgb(255, 255, 255)");
  const rf = page.locator(".react-flow");
  expect(await css(rf, "backgroundColor")).not.toBe("rgb(255, 255, 255)");
  await expect(page.getByTestId("dot-grid")).toBeVisible();
  await expect(page.getByTestId("canvas-vignette")).toHaveCSS("pointer-events", "none");
  expect(await css(page.getByTestId("canvas-vignette"), "backgroundImage")).toContain(
    "radial-gradient",
  );
});

test("hint shows on first visit, dismisses on one interaction, survives reload, ? reopens", async ({
  page,
}) => {
  await open(page);
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveText(/Scroll to zoom, drag to pan, click a topic/);
  const p = await paneCentre(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -100);
  await expect(hint(page)).toBeHidden();
  const stored = await page.evaluate(`localStorage.getItem("laf:ui:v1")`);
  expect(JSON.parse(stored as string)).toMatchObject({ v: 1, graphHintDismissed: true });

  await page.reload();
  await expect(topic(page, "stats")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show hint" })).toBeVisible();
  await expect(hint(page)).toBeHidden();

  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(hint(page)).toBeVisible();
  await hint(page).getByRole("button", { name: "Dismiss hint" }).click();
  await expect(hint(page)).toBeHidden();
});

test("a drag also dismisses the hint", async ({ page }) => {
  await open(page);
  await expect(hint(page)).toBeVisible();
  const p = await paneCentre(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 30, p.y, { steps: 4 });
  await page.mouse.up();
  await expect(hint(page)).toBeHidden();
});

test("grab and grabbing cursors on the pane", async ({ page }) => {
  await open(page);
  const pane = page.locator(".react-flow__pane");
  expect(await css(pane, "cursor")).toBe("grab");
  const p = await paneCentre(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 20, p.y, { steps: 3 });
  expect(await css(pane, "cursor")).toBe("grabbing");
  await page.mouse.up();
});

test("zoom in, zoom out and fit change the viewport; buttons are 44px, labelled, keyboard operable", async ({
  page,
}) => {
  await open(page);
  const k0 = await scale(page);
  const zin = page.getByRole("button", { name: "Zoom in" });
  const zout = page.getByRole("button", { name: "Zoom out" });
  const fit = page.getByRole("button", { name: "Fit to screen" });
  for (const b of [zin, zout, fit, page.getByRole("button", { name: "Show hint" })]) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await zin.click();
  await expect.poll(() => scale(page)).toBeGreaterThan(k0);
  await zout.click();
  await zout.click();
  await expect.poll(() => scale(page)).toBeLessThan(k0);
  await fit.click();
  await expect.poll(async () => Math.abs((await scale(page)) - k0)).toBeLessThan(0.01);

  // Keyboard: focus the button, press Enter and Space.
  await zin.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => scale(page)).toBeGreaterThan(k0);
  await fit.focus();
  await page.keyboard.press("Space");
  await expect.poll(async () => Math.abs((await scale(page)) - k0)).toBeLessThan(0.01);
  // Tooltip appears on focus.
  await zin.focus();
  await expect(page.getByText("Zoom in", { exact: true }).last()).toBeVisible();
});

test("hint and toolbar do not cover nodes or Start/Goal markers at the default fit", async ({
  page,
}) => {
  await open(page);
  await expect(hint(page)).toBeVisible();
  const targets = [
    ...(await page.locator("button[data-topic-id]").all()),
    ...(await page
      .locator("button[data-topic-id] span")
      .filter({ hasText: /^(Start|Goal)$/ })
      .all()),
  ];
  expect(targets.length).toBeGreaterThan(2);
  const overlays = [hint(page), page.getByRole("toolbar", { name: "Roadmap canvas" })];
  const minimap = page.locator(".react-flow__minimap");
  if (await minimap.isVisible()) overlays.push(minimap);
  for (const o of overlays) {
    const a = (await o.boundingBox())!;
    for (const t of targets) {
      const b = (await t.boundingBox())!;
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart, `overlay covers ${await t.textContent()}`).toBe(true);
    }
  }
});

test("minimap is visible at 1280 and hidden under 1100", async ({ page }) => {
  await open(page);
  await expect(page.locator(".react-flow__minimap")).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator(".react-flow__minimap")).toBeHidden();
});

test("axe is clean with the hint open", async ({ page }) => {
  await open(page);
  await expect(hint(page)).toBeVisible();
  await expectNoA11yViolations(page, { label: "graph canvas controls" });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("viewport changes without animation and the hint does not animate", async ({ page }) => {
    await open(page);
    await expect(hint(page)).toBeVisible();
    expect(await hint(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    const k0 = await scale(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    // No tween: the new scale is in place on the next frame, with no intermediate steps to wait for.
    await page.waitForTimeout(60);
    expect(await scale(page)).toBeGreaterThan(k0 * 1.1);
  });
});
