import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-024: contour map visuals. Look and feel is judged by the human at Gate 3; these pin the machine-checkable parts.
test.beforeAll(seedRoadmapFixture);

const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
const patternTransform = (page: Page) =>
  page.locator("#contour-tile").getAttribute("patternTransform");
const emptyPanePoint = (page: Page) =>
  page.evaluate(`(() => {
    const pane = document.querySelector(".react-flow__pane");
    const r = pane.getBoundingClientRect();
    for (let fy = 0.9; fy >= 0.1; fy -= 0.1) {
      for (let fx = 0.5; fx <= 0.9; fx += 0.1) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    throw new Error("no empty pane point");
  })()`) as Promise<{ x: number; y: number }>;
// The e2e tsconfig has no DOM lib; declare the one browser global the evaluate callbacks need.
declare const getComputedStyle: (el: unknown) => { getPropertyValue(p: string): string };
const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const css = (page: Page, selector: string, prop: string) =>
  style(page.locator(selector).first(), prop);

const routeColor = (page: Page) =>
  page.evaluate(`(() => {
    const d = document.createElement("div");
    d.style.color = "var(--route)";
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  })()`) as Promise<string>;

async function open(page: Page) {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(topic(page, "stats")).toBeVisible();
}

test("contour layer is decorative, below the nodes and adds no tab stops", async ({ page }) => {
  await open(page);
  const svg = page.getByTestId("contour-layer");
  await expect(svg).toHaveAttribute("aria-hidden", "true");
  await expect(svg).toHaveAttribute("focusable", "false");
  expect(await style(svg, "pointer-events")).toBe("none");
  await expect(svg.locator("[tabindex], a, button")).toHaveCount(0);
  await expect(page.locator("#contour-tile")).toHaveAttribute("width", "480");
  await expect(page.locator("#contour-tile")).toHaveAttribute("height", "320");
  expect(await svg.locator("path").first().getAttribute("vector-effect")).toBe(
    "non-scaling-stroke",
  );
  await expect(page.locator(".react-flow > [data-testid=contour-layer]")).toHaveCount(1);
  expect(Number(await style(svg, "z-index"))).toBeLessThan(0); // painted under the node layer
});

test("contour follows pan and zoom", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(600); // fit-view settles
  const t0 = await patternTransform(page);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => patternTransform(page)).not.toBe(t0);
  const t1 = await patternTransform(page);
  const p = await emptyPanePoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 40, p.y - 20, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => patternTransform(page)).not.toBe(t1);
});

test("unmet edges are dashed; selecting a topic draws solid hot edges, deselect removes them", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".edge-hot")).toHaveCount(0);
  const dash = await css(page, ".react-flow__edge .edge-unmet", "stroke-dasharray");
  expect(dash).not.toBe("none");
  expect(await css(page, ".react-flow__edge .edge-unmet", "stroke-width")).toBe("1.5px");

  await topic(page, "stats").click();
  const hot = page.locator(".edge-hot");
  await expect.poll(() => hot.count()).toBeGreaterThan(0); // horizontal paths have no height, so not "visible"
  expect(await hot.first().getAttribute("pathLength")).toBe("1");
  expect(await css(page, ".edge-hot", "stroke-width")).toBe("3.5px");
  expect(await css(page, ".edge-hot", "animation-name")).toBe("edge-draw");
  await topic(page, "stats").click(); // second click toggles selection off
  await page.keyboard.press("Escape"); // closes the topic panel and clears the selection
  await expect(hot).toHaveCount(0);
});

test("collapsed lane re-routed edge uses the same edge component", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Math, 2 topics/ }).click();
  await expect(page.locator(".react-flow__edge .edge-unmet")).toHaveCount(1);
});

test.describe("lane borders", () => {
  test("resting lane has no border; covered lane has a 1.5px route border; selection stays blaze", async ({
    page,
  }) => {
    await open(page);
    const lane = page.locator('button[data-area="math"]').locator("xpath=..");
    expect(await style(lane, "border-top-width")).toBe("0px");
    await page.getByRole("button", { name: /Show what you already know/ }).click();
    const covered = page.locator('button[data-area="__covered"]').locator("xpath=..");
    await expect(covered).toBeVisible();
    // Chrome snaps borders to whole pixels in computed style (1.5px reads back as 1px even at DPR 2), so pin
    // the intent instead: a visible border in the route colour from the 1.5px utility.
    await expect(covered).toHaveClass(/border-\[1\.5px\]/);
    expect(await style(covered, "border-top-width")).not.toBe("0px");
    expect(await style(covered, "border-top-color")).toBe(await routeColor(page));
    await topic(page, "stats").click();
    await expect(topic(page, "stats")).toHaveAttribute("data-selected", "true");
    const blaze = (await page.evaluate(`(() => {
    const d = document.createElement("div");
    d.style.backgroundColor = "var(--highlight)";
    document.body.append(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  })()`)) as string;
    await expect.poll(() => style(topic(page, "stats"), "background-color")).toBe(blaze); // after the 120ms colour transition
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("hot edges appear solid at once and nodes do not glide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await topic(page, "stats").click();
    await expect.poll(() => page.locator(".edge-hot").count()).toBeGreaterThan(0);
    expect(await css(page, ".edge-hot", "animation-name")).toBe("none");
    expect(await css(page, ".edge-hot", "stroke-dashoffset")).toBe("0px");
    const dur =
      parseFloat(await style(page.locator(".react-flow__node").first(), "transition-duration")) *
      1000;
    expect(dur).toBeLessThan(20);
  });

  test("contour still follows the viewport", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(600);
    const t0 = await patternTransform(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => patternTransform(page)).not.toBe(t0);
  });
});
