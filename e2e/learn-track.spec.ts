import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-047. Fixtures: e2e/fixtures/learn (system-design live, ai-engineering coming-soon).
type HTMLLike = { scrollWidth: number; clientWidth: number };
const TRACK = "/learn/system-design";
const KEY = "laf:learn:v1";

test.describe("learn track page", () => {
  test("concepts tab: header, level group, rows, axe; Continue hidden when empty", async ({
    page,
  }) => {
    await page.goto(TRACK);
    await expect(page.getByRole("heading", { level: 1, name: "System design" })).toBeVisible();
    await expect(page.getByTestId("track-ring")).toHaveAttribute("aria-label", /0% of/);
    await expect(page.locator("section#basic")).toContainText("Caching");
    await expect(page.locator("section#basic").getByText("Sim", { exact: true })).toBeVisible();
    await expect(page.getByTestId("continue")).toHaveCount(0);
    await expectNoA11yViolations(page, { label: "learn track concepts" });
  });

  test("problems tab is its own URL; tabs keyboard operable", async ({ page }) => {
    await page.goto(TRACK);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(page.getByRole("tab", { name: /Concepts/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /Concepts/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Problems/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${TRACK}/problems`, { timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /Problems/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tabpanel")).toContainText("URL shortener");
    await expectNoA11yViolations(page, { label: "learn track problems" });
  });

  test("Continue appears after visiting a page; favorite persists across reload", async ({
    page,
  }) => {
    await page.goto(`${TRACK}/concepts/caching`);
    await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).not.toBeNull();
    await page.goto(TRACK);
    const cont = page.getByTestId("continue");
    await expect(cont).toBeVisible();
    await cont.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(`${TRACK}/concepts/caching`);

    await page.goto(TRACK);
    const star = page.getByRole("button", { name: "Favorite Caching" });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Favorite Caching" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("mobile width: no horizontal overflow, axe clean", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(TRACK);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const el = (globalThis as unknown as { document: { documentElement: HTMLLike } }).document
        .documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflow).toBe(false);
    await expectNoA11yViolations(page, { label: "learn track mobile" });
  });

  test("coming-soon track renders no packs and no tabs", async ({ page, request }) => {
    await page.goto("/learn/ai-engineering");
    await expect(page.getByRole("heading", { level: 1, name: "AI engineering" })).toBeVisible();
    await expect(page.getByText("Coming soon", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expectNoA11yViolations(page, { label: "learn coming soon" });
    expect((await request.get("/learn/ai-engineering/problems")).status()).toBe(404);
    expect((await request.get("/learn/nope")).status()).toBe(404);
  });
});
