import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-099. Concept cards on the track page Concepts tab (prototype variant A: favorite star, thin progress bar).
const TRACK = "/learn/system-design";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("laf:ui:v1", '{"v":1,"rail":0.8}'));
});

test.describe("concept cards", () => {
  test("cards are tall, summary is one ellipsized line, star is 44px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(TRACK);
    const cards = page.getByTestId("concept-card");
    await expect(cards.first()).toBeVisible();
    for (const c of await cards.all()) {
      expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(64);
      const s = c.getByTestId("concept-summary");
      await expect(s).not.toBeEmpty();
      await expect(s).toHaveCSS("white-space", "nowrap");
      await expect(s).toHaveCSS("text-overflow", "ellipsis");
      await expect(s).toHaveCSS("overflow", "hidden");
      expect((await s.boundingBox())!.height).toBeLessThanOrEqual(24); // one 14px line
      const star = c.getByRole("button", { name: /^Favorite / });
      const b = (await star.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      await expect(c.getByRole("progressbar")).toBeVisible();
    }
  });

  test("star toggles, persists across reload, never navigates; link navigates; Tab order", async ({
    page,
  }) => {
    await page.goto(TRACK);
    const card = page.getByTestId("concept-card").first();
    const link = card.getByRole("link");
    const name = (await link.innerText()).trim();
    const star = card.getByRole("button", { name: `Favorite ${name}` });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(TRACK);
    await page.reload();
    const again = page
      .getByTestId("concept-card")
      .first()
      .getByRole("button", {
        name: `Favorite ${name}`,
      });
    await expect(again).toHaveAttribute("aria-pressed", "true");
    await again.click();
    await expect(again).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(TRACK);

    await link.focus();
    await page.keyboard.press("Tab");
    await expect(star).toBeFocused();

    await link.click();
    await expect(page).toHaveURL(/\/learn\/system-design\/concepts\/[a-z-]+$/);
  });

  test("320px: no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(TRACK);
    await expect(page.getByTestId("concept-card").first()).toBeVisible();
    const over = (await page.evaluate(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth",
    )) as number;
    expect(over).toBeLessThanOrEqual(0);
    for (const c of await page.getByTestId("concept-card").all()) {
      const b = (await c.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(320);
    }
  });

  test("axe clean on the Concepts tab", async ({ page }) => {
    await page.goto(TRACK);
    await expect(page.getByTestId("concept-card").first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("reduced motion: no transition on the card", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(TRACK);
    const inner = page.getByTestId("concept-card").first().locator("> div");
    await expect(inner).toBeVisible();
    await expect(inner).toHaveCSS("transition-duration", /^(0|1e-05|0\.00001)s$/);
  });
});
