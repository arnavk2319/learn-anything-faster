import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// The e2e tsconfig has no DOM lib; declare the browser globals the evaluate callbacks need.
/* eslint-disable @typescript-eslint/no-explicit-any -- DOM types are unavailable here; callbacks run in the browser */
declare const getComputedStyle: (el: any, pseudo?: string) => any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const URL = "/learn/primitives-preview";
const NON_TRANSPARENT = /rgba?\((?!0, 0, 0, 0\))/;
const zero = (t: string) => t === "none" || t.split(" ").every((v) => parseFloat(v) === 0);
const sel = (s: string) => `[data-sample="${s}"]`;

async function cs(page: Page, selector: string, props: string[]) {
  return page.locator(selector).evaluate((el, ps) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(ps.map((p: string) => [p, s.getPropertyValue(p)]));
  }, props);
}

async function settle(page: Page) {
  await page.waitForTimeout(400);
}

test.describe("T-078 primitives", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("hover lifts 1px with shadow; active presses and collapses shadow", async ({ page }) => {
    await page.goto(URL);
    for (const v of ["primary", "secondary"]) {
      const target = sel(`${v}-md`);
      const rest = await cs(page, target, ["translate", "box-shadow"]);
      await page.hover(target);
      await settle(page);
      const hov = await cs(page, target, ["translate", "box-shadow"]);
      expect(hov.translate).toBe("0px -1px");
      expect(hov["box-shadow"]).not.toBe(rest["box-shadow"]);
      expect(hov["box-shadow"]).not.toBe("none");
      await page.mouse.down();
      await settle(page);
      const act = await cs(page, target, ["translate", "scale", "box-shadow"]);
      expect(act.translate).toBe("0px 1px");
      expect(act.scale).toBe("0.98");
      expect(act["box-shadow"]).not.toMatch(NON_TRANSPARENT);
      await page.mouse.up();
    }
  });

  test("disabled stays dimmed and inert; focus ring is visible", async ({ page }) => {
    await page.goto(URL);
    const d = await cs(page, sel("disabled"), ["opacity", "pointer-events"]);
    expect(d.opacity).toBe("0.4");
    expect(d["pointer-events"]).toBe("none");
    await page.locator(sel("primary-sm")).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const f = await cs(page, sel("primary-sm"), ["outline-style", "outline-width"]);
    expect(f["outline-style"]).toBe("solid");
    expect(f["outline-width"]).toBe("2px");
  });

  test("reduced motion: no transform or transition on primitives", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    const target = sel("primary-md");
    await page.hover(target);
    await settle(page);
    const h = await cs(page, target, ["translate", "transition-duration"]);
    expect(zero(h.translate)).toBe(true);
    expect(parseFloat(h["transition-duration"])).toBeLessThanOrEqual(0.00001);
    await page.mouse.down();
    const a = await cs(page, target, ["translate", "scale"]);
    expect(zero(a.translate)).toBe(true);
    expect(a.scale).toBe("1");
    await page.mouse.up();
    for (const s of ["card", "chip-button"]) {
      const t = await cs(page, sel(s), ["transition-duration"]);
      expect(parseFloat(t["transition-duration"])).toBeLessThanOrEqual(0.00001);
    }
  });

  test("44px hit area at 28/32/36", async ({ page }) => {
    await page.goto(URL);
    for (const [size, h] of [
      ["sm", 28],
      ["md", 32],
      ["lg", 36],
    ] as const) {
      const box = await page.locator(sel(`primary-${size}`)).boundingBox();
      expect(box?.height).toBe(h);
      const hit = await page.locator(sel(`primary-${size}`)).evaluate((el) => {
        const s = getComputedStyle(el, "::after");
        return [parseFloat(s.width), parseFloat(s.height)];
      });
      expect(hit[0]).toBeGreaterThanOrEqual(44);
      expect(hit[1]).toBeGreaterThanOrEqual(44);
    }
  });

  test("tabs: roving focus with arrow keys, Home and End", async ({ page }) => {
    await page.goto(URL);
    await page.locator("#tab-a").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#tab-b")).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.locator("#tab-c")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#tab-a")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#tab-c")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.locator("#tab-a")).toBeFocused();
  });

  test("progress ring and bar expose progressbar semantics", async ({ page }) => {
    await page.goto(URL);
    for (const id of ["ring-sm", "ring-md", "ring-lg", "bar"]) {
      const el = page.getByTestId(id);
      await expect(el).toHaveAttribute("role", "progressbar");
      await expect(el).toHaveAttribute("aria-valuemin", "0");
      await expect(el).toHaveAttribute("aria-valuemax", "100");
      await expect(el).toHaveAttribute("aria-valuenow", /^(38|60)$/);
    }
  });

  test("axe clean", async ({ page }) => {
    await page.goto(URL);
    await expectNoA11yViolations(page);
  });

  test("landing hero CTA computed styles unchanged (no tactile leakage)", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("I am a").selectOption("home-a");
    await page.getByLabel("and I want to be a").selectOption("home-b");
    await expect(page.getByRole("link", { name: "Show my roadmap" })).toBeVisible();
    const s = await cs(page, 'a[href="/roadmap?from=home-a&to=home-b"]', [
      "height",
      "border-radius",
      "box-shadow",
      "translate",
      "background-color",
      "border-top-width",
    ]);
    expect(s["box-shadow"]).toBe("none");
    expect(s.translate).toBe("none");
    expect(s["border-top-width"]).toBe("0px");
    expect(s.height).toBe("52px");
    expect(s["border-radius"]).toBe("10px");
    expect(s["background-color"]).not.toBe("rgba(0, 0, 0, 0)");
  });
});
