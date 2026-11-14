import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

const URL = "/learn/sim-preview";
const SIM = '[data-sim="cache-aside-read"]';

async function liveSim(page: Page) {
  await page.goto(URL);
  const root = page.locator(SIM);
  // The first sim is in the viewport, so its island hydrates on load; the poster is swapped for the player.
  await expect(page.locator('[data-sim-island="live"]').first()).toBeVisible();
  await expect(
    root.getByRole("toolbar").getByRole("button", { name: /^(Play|Pause)$/ }),
  ).toBeEnabled();
  return root;
}

test.describe("learn sim renderer", () => {
  test("no JS: static poster and numbered transcript are server-rendered", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(URL);
    await expect(page.locator(`${SIM} svg`).first()).toBeVisible();
    await expect(page.locator(`${SIM} [data-node="cache"]`)).toBeAttached();
    const transcript = page.locator("details", { hasText: "Read this as text" }).first();
    await transcript.locator("summary").click();
    await expect(transcript.locator("ol li").first()).toHaveText(
      "Miss: loaded from the database and cached",
    );
    await ctx.close();
  });

  test("plays one fixture sim: step to the final caption, keyboard works", async ({ page }) => {
    const root = await liveSim(page);
    const caption = root.getByTestId("sim-caption");
    await root.getByRole("button", { name: "Pause" }).click(); // pause is always present while playing
    await root.getByRole("button", { name: "Restart" }).click();
    await root.getByRole("group", { name: /diagram/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(caption).toContainText("Miss: loaded from the database and cached");
    await expect(caption).toContainText("Step 1 of 1");
    await expect(root.locator("svg text").filter({ hasText: /^d$/ })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toContainText("Step 0 of 1");
    await page.keyboard.press("Space");
    await expect(root.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("inspector opens on Enter, closes on Escape and returns focus", async ({ page }) => {
    const root = await liveSim(page);
    const node = root.locator('[data-node="cache"]');
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(root.getByRole("complementary", { name: /Cache details/ })).toBeVisible();
    await expect(root.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(root.getByRole("complementary")).toHaveCount(0);
    await expect(node).toBeFocused();
  });

  test("reduced motion: no autoplay, step mode, axe clean", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const root = await liveSim(page);
    await expect(root.getByText("Reduced motion is on")).toBeVisible();
    await expect(root.getByRole("button", { name: "Play" })).toBeVisible();
    const caption = root.getByTestId("sim-caption");
    await expect(caption).toContainText("Step 0 of 1");
    await page.waitForTimeout(1200);
    await expect(caption).toContainText("Step 0 of 1");
    await root.getByRole("button", { name: "Step forward" }).click();
    await expect(caption).toContainText("Miss: loaded from the database and cached");
    await expectNoA11yViolations(page, { label: "learn sim preview" });
  });

  test("axe clean while playing", async ({ page }) => {
    await liveSim(page);
    await expectNoA11yViolations(page, { label: "learn sim preview playing" });
  });
});
