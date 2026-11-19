import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-079. Learn shell on concept and problem pages. The fixture track holds one very long outline label
// (e2e/fixtures/learn/system-design/concepts/long-label-fixture.yaml).
const CONCEPT = "/learn/system-design/concepts/caching";
const PROBLEM = "/learn/system-design/problems/url-shortener";
const KEY = "laf:ui:v1";

// The Next dev indicator overlays the bottom-left corner in dev and swallows pointer clicks on the bottom
// nav's first item; activate by keyboard instead (same handler).
const press = async (l: Locator) => {
  await l.focus();
  await l.press("Enter");
};
const sep = (page: Page) => page.getByRole("separator", { name: "Resize outline" });
const num = async (page: Page, attr: string) => Number(await sep(page).getAttribute(attr));

type Label = {
  text: string;
  sw: number;
  cw: number;
  tw: number;
  overflow: string;
  title: string | null;
};
async function labelMetrics(page: Page): Promise<Label[]> {
  // tw is the natural text width via Range (ignores overflow:hidden), sw/cw the clip test.
  return (await page.evaluate(`[...document.querySelectorAll("[data-outline-label]")].map((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return {
      text: el.textContent ?? "",
      sw: el.scrollWidth,
      cw: el.clientWidth,
      tw: r.getBoundingClientRect().width,
      overflow: getComputedStyle(el).textOverflow,
      title: el.getAttribute("title"),
    };
  })`)) as Label[];
}

// Wait for the client-side measurement (fonts ready) to settle before asserting on bounds.
async function ready(page: Page) {
  await expect(sep(page)).toBeVisible();
  await page.evaluate("document.fonts.ready.then(() => true)");
  await expect.poll(() => num(page, "aria-valuemax")).toBeGreaterThan(200);
}

test.describe("learn shell, desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const path of [CONCEPT, PROBLEM]) {
    test(`fills the viewport, 48px header, landmarks, axe: ${path}`, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      const m = (await page.evaluate(`({
        sh: document.documentElement.scrollHeight,
        ih: window.innerHeight,
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        header: document.querySelector("header")?.getBoundingClientRect().height,
      })`)) as { sh: number; ih: number; sw: number; iw: number; header: number };
      expect(m.sh).toBe(m.ih);
      expect(m.sw).toBeLessThanOrEqual(m.iw);
      expect(m.header).toBe(48);
      for (const role of ["banner", "navigation", "main", "complementary"] as const) {
        await expect(page.getByRole(role).first()).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
      await expectNoA11yViolations(page, { label: `shell desktop ${path}` });
    });
  }

  test("main scrolls on its own; rails and header stay put", async ({ page }) => {
    await page.goto(CONCEPT);
    await ready(page);
    const main = page.locator("main#main-content");
    const before = await page.getByTestId("outline-rail").boundingBox();
    await main.evaluate((el) =>
      (el as unknown as { scrollTo(x: number, y: number): void }).scrollTo(0, 400),
    );
    expect(
      await main.evaluate((el) => (el as unknown as { scrollTop: number }).scrollTop),
    ).toBeGreaterThan(0);
    expect(await page.evaluate("window.scrollY")).toBe(0);
    expect(await page.getByTestId("outline-rail").boundingBox()).toEqual(before);
  });

  test("separator semantics, keyboard steps, Home and End", async ({ page }) => {
    await page.goto(CONCEPT);
    await ready(page);
    const h = sep(page);
    await expect(h).toHaveAttribute("aria-orientation", "vertical");
    const min = await num(page, "aria-valuemin");
    const max = await num(page, "aria-valuemax");
    expect(await num(page, "aria-valuenow")).toBe(max); // default is max
    await h.focus();
    await page.keyboard.press("Home");
    expect(await num(page, "aria-valuenow")).toBe(min);
    await page.keyboard.press("ArrowRight");
    expect(await num(page, "aria-valuenow")).toBe(min + 8);
    await page.keyboard.press("Shift+ArrowRight");
    expect(await num(page, "aria-valuenow")).toBe(min + 40);
    await page.keyboard.press("ArrowLeft");
    expect(await num(page, "aria-valuenow")).toBe(min + 32);
    await page.keyboard.press("End");
    expect(await num(page, "aria-valuenow")).toBe(max);
    await page.keyboard.press("ArrowRight");
    expect(await num(page, "aria-valuenow")).toBe(max);
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await num(page, "aria-valuenow")).toBe(min);
    // The rendered rail width follows aria-valuenow.
    const w = (await page.getByTestId("outline-rail").boundingBox())?.width ?? 0;
    expect(Math.abs(w - min)).toBeLessThanOrEqual(1);
  });

  test("min shows >= 80% of the longest label, max shows all; drag is clamped", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    await ready(page);
    const min = await num(page, "aria-valuemin");
    const max = await num(page, "aria-valuemax");
    const labels = await labelMetrics(page);
    // At max: nothing clipped.
    for (const l of labels) expect(l.sw, l.text).toBeLessThanOrEqual(l.cw);
    const longest = labels.reduce((a, b) => (b.tw > a.tw ? b : a));
    // Measured text width of the longest label sets the range: max - min = 20% of it (within 2px).
    expect(Math.abs(max - min - 0.2 * longest.tw)).toBeLessThanOrEqual(2);

    const box = (await sep(page).boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    // Drag far left: clamps at min.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(20, y, { steps: 8 });
    await page.mouse.up();
    expect(Math.abs((await num(page, "aria-valuenow")) - min)).toBeLessThanOrEqual(2);
    const atMin = await labelMetrics(page);
    const clipped = atMin.find((l) => l.text === longest.text)!;
    expect(clipped.cw / longest.tw).toBeGreaterThanOrEqual(0.8 - 0.02);
    expect(clipped.sw).toBeGreaterThan(clipped.cw);
    expect(clipped.overflow).toBe("ellipsis");
    expect(clipped.title).toBe(longest.text);

    // Drag far right: clamps at max.
    const b2 = (await sep(page).boundingBox())!;
    await page.mouse.move(b2.x + b2.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(1200, y, { steps: 8 });
    await page.mouse.up();
    expect(Math.abs((await num(page, "aria-valuenow")) - max)).toBeLessThanOrEqual(2);
    for (const l of await labelMetrics(page)) expect(l.sw, l.text).toBeLessThanOrEqual(l.cw);
  });

  test("width persists across reload, clamps out-of-range, ignores corrupt values", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    await ready(page);
    const min = await num(page, "aria-valuemin");
    await sep(page).focus();
    await page.keyboard.press("Home");
    const stored = JSON.parse((await page.evaluate(`localStorage.getItem("${KEY}")`)) as string);
    expect(stored.v).toBe(1);
    expect(stored.rail).toBeCloseTo(0.8, 2);
    await page.reload();
    await ready(page);
    expect(Math.abs((await num(page, "aria-valuenow")) - min)).toBeLessThanOrEqual(1);

    await page.evaluate(`localStorage.setItem("${KEY}", JSON.stringify({ v: 1, rail: 0.01 }))`);
    await page.reload();
    await ready(page);
    expect(Math.abs((await num(page, "aria-valuenow")) - min)).toBeLessThanOrEqual(1);

    const max = await num(page, "aria-valuemax");
    await page.evaluate(`localStorage.setItem("${KEY}", "{corrupt")`);
    await page.reload();
    await ready(page);
    expect(await num(page, "aria-valuenow")).toBe(max);
  });

  test("right rail shows next up, collapses and remembers", async ({ page }) => {
    await page.goto(CONCEPT);
    await ready(page);
    const rail = page.getByTestId("right-rail");
    await expect(rail.getByRole("link", { name: "URL shortener" })).toBeVisible();
    const open = (await rail.boundingBox())!.width;
    expect(open).toBeGreaterThan(300);
    const toggle = rail.getByRole("button", { name: /page outline/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await rail.boundingBox())!.width).toBeLessThan(60);
    await expect(rail.getByRole("link", { name: "URL shortener" })).toBeHidden();
    await page.reload();
    await expect(rail.getByRole("button", { name: /page outline/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect((await rail.boundingBox())!.width).toBeLessThan(60);
  });

  test("reduced motion: no transitions on rail, handle or right rail", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(CONCEPT);
    await ready(page);
    const durs =
      (await page.evaluate(`["[data-testid=outline-rail]", "[data-testid=right-rail]", "[data-testid=rail-handle]"].map(
      (s) => getComputedStyle(document.querySelector(s)).transitionDuration,
    )`)) as string[];
    for (const d of durs) expect(d.split(",").every((x) => parseFloat(x) < 0.001)).toBe(true);
  });
});

test.describe("learn shell, mobile", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("one pane, bottom nav >= 44px, no handle, no horizontal overflow, axe", async ({ page }) => {
    await page.goto(CONCEPT);
    await expect(page.getByRole("button", { name: "Content" })).toBeVisible();
    await expect(page.getByRole("separator")).toHaveCount(0);
    for (const name of ["Outline", "Content", "Next"]) {
      const b = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(b.height, name).toBeGreaterThanOrEqual(44);
    }
    const m = (await page.evaluate(`({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      sh: document.documentElement.scrollHeight,
      ih: window.innerHeight,
    })`)) as { sw: number; iw: number; sh: number; ih: number };
    expect(m.sw).toBeLessThanOrEqual(m.iw);
    expect(m.sh).toBeLessThanOrEqual(m.ih);
    await expectNoA11yViolations(page, { label: "shell mobile content" });

    await press(page.getByRole("button", { name: "Outline", exact: true }));
    await expect(page.getByTestId("outline-rail")).toBeVisible();
    await expect(page.locator("main#main-content")).toBeHidden();
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
    await expectNoA11yViolations(page, { label: "shell mobile outline" });

    await press(page.getByRole("button", { name: "Next", exact: true }));
    await expect(page.getByTestId("right-rail")).toBeVisible();
    await expectNoA11yViolations(page, { label: "shell mobile next" });

    await press(page.getByRole("button", { name: "Outline", exact: true }));
    await page
      .getByTestId("outline-rail")
      .getByRole("link", { name: /URL shortener/ })
      .click();
    await expect(page).toHaveURL(PROBLEM);
  });
});
