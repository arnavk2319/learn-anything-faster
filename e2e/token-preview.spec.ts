import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// The e2e tsconfig has no DOM lib; declare the browser globals the evaluate callbacks need.
/* eslint-disable @typescript-eslint/no-explicit-any -- DOM types are unavailable here; callbacks run in the browser */
declare const getComputedStyle: (el: any, pseudo?: string) => any;
declare const document: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const URL = "/learn/token-preview";

async function measure(page: Page, scope: string) {
  return page.evaluate((s) => {
    const q = (sel: string) => document.querySelector(sel ? `#${s} ${sel}` : `#${s}`);
    const cs = (el: unknown) => getComputedStyle(el);
    const ctl = q('[data-sample="control"]');
    return {
      body: cs(q('[data-sample="body"]')).fontSize,
      h1: cs(q('[data-sample="h1"]')).fontSize,
      h2: cs(q('[data-sample="h2"]')).fontSize,
      controlH: ctl.getBoundingClientRect().height,
      hitH: parseFloat(getComputedStyle(ctl, "::after").height),
      panelBorder: cs(q("")).borderTopColor,
      transition: cs(q("")).transitionDuration,
    };
  }, scope);
}

test.describe("T-077 tokens", () => {
  test("compact tier differs from default; default matches :root", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    const c = await measure(page, "compact-samples");
    const d = await measure(page, "default-samples");
    expect(c.body).toBe("14px");
    expect(d.body).toBe("16px");
    expect(parseFloat(c.h1)).toBeGreaterThanOrEqual(24);
    expect(parseFloat(c.h1)).toBeLessThanOrEqual(28);
    expect(parseFloat(c.h2)).toBeGreaterThanOrEqual(17);
    expect(parseFloat(c.h2)).toBeLessThanOrEqual(20);
    expect(c.controlH).toBe(32);
    expect(d.controlH).toBe(40);
    expect(c.hitH).toBeGreaterThanOrEqual(44);
    expect(c.panelBorder).not.toBe(d.panelBorder);
  });

  test("landing font sizes are untouched by the tokens", async ({ page }) => {
    await page.goto("/");
    const size = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    expect(size).toBe("16px");
  });

  test("reduced motion: transitions and lift/press tokens are effectively zero", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    const m = await measure(page, "compact-samples");
    const secs = parseFloat(m.transition);
    expect(secs).toBeLessThanOrEqual(0.00001);
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [
        "--press-y",
        "--lift-y",
        "--dur-lift",
        "--dur-press",
        "--dur-spring",
        "--burst-dur",
      ].map((t) => s.getPropertyValue(t).trim());
    });
    expect(tokens.slice(0, 2)).toEqual(["0px", "0px"]);
    // The engine may serialise 0ms as 0s.
    for (const t of tokens.slice(2)) expect(parseFloat(t)).toBe(0);
  });

  test("axe clean", async ({ page }) => {
    await page.goto(URL);
    await expectNoA11yViolations(page);
  });
});
