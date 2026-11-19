import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-087: roadmap restyle (hover lift, reduced motion, one Blaze element, panel scroll, axe, mobile overflow).
test.beforeAll(seedRoadmapFixture);

declare const getComputedStyle: (el: unknown) => { getPropertyValue(p: string): string };
const URL = "/roadmap/dev/ml-dev";
const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

// Counts visible elements in the roadmap content (everything but the site header's logo) painted with the Blaze token.
async function blazeNames(page: Page): Promise<string[]> {
  return page.evaluate(`(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--highlight)";
    document.body.append(probe);
    const blaze = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const names = [];
    for (const el of document.querySelectorAll("main *, [data-testid=topic-panel], [data-testid=topic-panel] *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).backgroundColor === blaze) { names.push(el.tagName + "." + String(el.className).slice(0, 50)); }
    }
    return names;
  })()`) as Promise<string[]>;
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("one Blaze element: the target role at rest, the selected topic once chosen", async ({
    page,
  }) => {
    await page.goto(URL);
    await expect(topic(page, "stats")).toBeVisible();
    expect(await blazeNames(page)).toHaveLength(1);
    await topic(page, "stats").click();
    await expect(topic(page, "stats")).toHaveAttribute("data-selected", "true");
    await page.mouse.move(0, 0);
    await expect.poll(() => blazeNames(page)).toHaveLength(1);
    await page.getByRole("button", { name: /Show what you already know/ }).click();
    await expect.poll(() => blazeNames(page)).toHaveLength(1);
  });

  test("hover lifts 1px and press shrinks; the React Flow wrapper is untouched", async ({
    page,
  }) => {
    await page.goto(URL);
    const t = topic(page, "stats");
    await expect(t).toBeVisible();
    const wrapper = t.locator("xpath=ancestor::div[contains(@class,'react-flow__node')][1]");
    const wrapperTransform = await style(wrapper, "transform");
    await t.hover();
    await expect.poll(() => style(t, "translate")).toBe("0px -1px");
    expect(await style(wrapper, "transform")).toBe(wrapperTransform);
    await page.mouse.down();
    await expect.poll(() => style(t, "scale")).toBe("0.98");
    await page.mouse.up();
  });

  test("reduced motion zeroes lift and press", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    const t = topic(page, "stats");
    await expect(t).toBeVisible();
    await t.hover();
    await page.waitForTimeout(100);
    expect(["none", "0px", "0px 0px"]).toContain(await style(t, "translate"));
    await page.mouse.down();
    await page.waitForTimeout(100);
    expect(["none", "1"]).toContain(await style(t, "scale"));
    await page.mouse.up();
  });

  test("panel uses compact type, resources scroll inside it, axe clean with panel open", async ({
    page,
  }) => {
    await page.goto(URL);
    await topic(page, "torch").click();
    const panel = page.getByTestId("topic-panel");
    await expect(panel).toBeVisible();
    expect(await style(panel, "font-size")).toBe("14px");
    await expect(panel.getByText("Learn these first", { exact: true })).toBeVisible();
    const body = page.getByTestId("topic-panel-body");
    expect(await style(body, "overflow-y")).toBe("auto");
    const box = (await panel.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(800);
    await expectNoA11yViolations(page, { label: "roadmap restyle panel open" });
  });

  test("toolbar buttons are 44px tall and wide", async ({ page }) => {
    await page.goto(URL);
    const zoom = page.getByRole("button", { name: "Zoom in" });
    await expect(zoom).toBeVisible();
    const b = (await zoom.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe("mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const view of ["graph", "list"] as const) {
    test(`${view}: no horizontal overflow with the panel open`, async ({ page }) => {
      await page.goto(`${URL}?view=${view}`);
      await topic(page, "stats").click();
      await expect(page.getByTestId("topic-panel")).toBeVisible();
      const over = await page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth",
      );
      expect(over).toBe(false);
    });
  }
});
