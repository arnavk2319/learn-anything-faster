import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-088: /roadmaps and the notify/request forms use the v2 compact shell and primitives.
// The e2e tsconfig has no DOM lib; evaluate callbacks are passed as strings or typed loosely.
declare const document: { activeElement: unknown };
declare const getComputedStyle: (
  el: unknown,
  pseudo?: string,
) => { getPropertyValue(p: string): string };

test.beforeAll(seedRoadmapFixture);

const noHScroll = (page: Page) =>
  page.evaluate("document.documentElement.scrollWidth <= window.innerWidth");

for (const [w, h] of [
  [375, 800],
  [768, 900],
  [1024, 800],
  [1280, 800],
] as const) {
  test(`/roadmaps at ${w}px: v2 compact, no horizontal overflow, no page scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/roadmaps");
    await expect(page.getByTestId("catalog-entry").first()).toBeVisible();
    await expect(page.locator('[data-ui="v2"][data-density="compact"]')).toHaveCount(1);
    expect(await noHScroll(page)).toBe(true);
    expect(await page.evaluate("document.documentElement.scrollHeight <= window.innerHeight")).toBe(
      true,
    );
    const header = (await page.getByRole("banner").boundingBox())!;
    expect(Math.round(header.height)).toBe(48);
  });
}

test("tall list scrolls inside main, not the document", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/roadmaps");
  const main = page.getByTestId("catalog-scroll");
  await expect(page.getByTestId("catalog-entry").first()).toBeVisible();
  const m = await main.evaluate((el) => ({
    scrollable: el.scrollHeight > el.clientHeight,
    overflowY: getComputedStyle(el).getPropertyValue("overflow-y"),
  }));
  expect(m.overflowY).toBe("auto");
  expect(await page.evaluate("document.documentElement.scrollHeight <= window.innerHeight")).toBe(
    true,
  );
  if (m.scrollable) {
    await main.evaluate((el) => ((el as unknown as { scrollTop: number }).scrollTop = 9999));
    expect(
      await main.evaluate((el) => (el as unknown as { scrollTop: number }).scrollTop),
    ).toBeGreaterThan(0);
    expect(await page.evaluate("window.scrollY")).toBe(0);
  }
});

test("filters, buttons and inputs use compact tokens and 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/roadmaps?status=coming-soon");
  const form = page.getByRole("form").first();
  await expect(form).toBeVisible();
  const input = form.getByLabel("Email");
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const button = form.getByRole("button", { name: "Notify me" });
  expect(Math.round((await button.boundingBox())!.height)).toBe(36); // control-lg in the compact tier
  const hit = await button.evaluate((el) => {
    const cs = getComputedStyle(el, "::after");
    return [parseFloat(cs.getPropertyValue("width")), parseFloat(cs.getPropertyValue("height"))];
  });
  expect(hit[0]).toBeGreaterThanOrEqual(44);
  expect(hit[1]).toBeGreaterThanOrEqual(44);
  const filter = page.getByRole("link", { name: "Live", exact: true });
  const fh = await filter.evaluate((el) =>
    parseFloat(getComputedStyle(el, "::after").getPropertyValue("height")),
  );
  expect(fh).toBeGreaterThanOrEqual(44);
  expect(await noHScroll(page)).toBe(true);
});

test("form error links aria-describedby, keyboard order, focus ring, axe", async ({ page }) => {
  await page.goto("/roadmaps?status=coming-soon");
  const form = page.getByRole("form").first();
  const input = form.getByLabel("Email");
  await input.fill("x"); // waits out hydration (controlled input) before keyboard use
  await input.clear();
  await input.focus();
  const ring = await input.evaluate((el) => getComputedStyle(el).getPropertyValue("box-shadow"));
  expect(ring).not.toBe("none");
  // Order is label, input, (Turnstile widget), submit: Tab at most twice from the input reaches the button.
  const submit = form.getByRole("button", { name: "Notify me" });
  for (let i = 0; i < 3 && !(await submit.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(form.getByText("Enter an email address")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const errId = await input.getAttribute("aria-describedby");
  expect(errId).toBeTruthy();
  await expect(page.locator(`[id="${errId}"]`)).toContainText("Enter an email address");
  await expectNoA11yViolations(page, { label: "browse form error" });
});

test("reduced motion: no lift or transition on the primary action", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/roadmaps");
  const link = page.getByRole("link", { name: "View roadmap" }).first();
  await expect(link).toBeVisible();
  await link.hover();
  const d = await link.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("transition-duration"),
  );
  expect(parseFloat(d)).toBeLessThanOrEqual(0.001);
});

test("landing / is not opted in to v2 or compact", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-ui]")).toHaveCount(0);
  await expect(page.locator("[data-density]")).toHaveCount(0);
  const bg = await page.evaluate("getComputedStyle(document.body).backgroundColor");
  expect(bg).not.toBe("rgb(246, 243, 234)");
  expect(await page.evaluate("getComputedStyle(document.documentElement).fontSize")).toBe("16px");
});
