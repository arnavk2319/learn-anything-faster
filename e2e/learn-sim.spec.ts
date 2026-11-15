import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

const URL = "/learn/sim-preview";
const SIM = '[data-sim="cache-aside-read"]';

async function liveSim(page: Page, sim = SIM) {
  await page.goto(URL);
  const root = page.locator(sim);
  // Sims below the fold hydrate when scrolled into view; scroll the stable wrapper, not the swapped root.
  if (sim !== SIM) await page.locator(`#${sim.match(/"([^"]+)"/)![1]}`).scrollIntoViewIfNeeded();
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
    const transcript = page.locator(`${SIM} details`, { hasText: "Read this as text" }).first();
    await transcript.locator("summary").click();
    await expect(transcript.locator("ol li").first()).toHaveText(
      "Hit: c is served from the cache and becomes most recent",
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
    const active = root.getByTestId("sim-steps").locator('[aria-current="step"]');
    await expect(active).toContainText("Hit: c is served from the cache and becomes most recent");
    await expect(caption).toContainText("Step 1 of 1");
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toContainText("Step 0 of 1");
    await expect(active).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(root.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("controls are icon-only; all steps stay listed; transcript lives inside the sim card", async ({
    page,
  }) => {
    const root = await liveSim(page);
    await expect(root.getByRole("button", { name: "Restart" })).toHaveText("");
    await expect(root.getByRole("button", { name: "Restart" })).toHaveAttribute("title", "Restart");
    await expect(root.getByTestId("sim-steps").locator("li")).not.toHaveCount(0);
    await expect(root.locator("details", { hasText: "Read this as text" })).toHaveCount(1);
    await root.getByRole("button", { name: "Pause" }).click();
    await root.getByRole("button", { name: "Restart" }).click();
    await root.getByTestId("sim-steps").getByRole("button").first().click();
    await expect(root.getByTestId("sim-steps").locator('[aria-current="step"]')).toHaveCount(1);
  });

  test("inspector opens on Enter, closes on Escape and returns focus", async ({ page }) => {
    const root = await liveSim(page);
    const node = root.locator('[data-node="cache"]');
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(root.getByRole("complementary", { name: /Cache.*details/ })).toBeVisible();
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
    await expect(root.getByTestId("sim-steps").locator('[aria-current="step"]')).toContainText(
      "Hit: c is served from the cache and becomes most recent",
    );
    await expectNoA11yViolations(page, { label: "learn sim preview" });
  });

  test("axe clean while playing", async ({ page }) => {
    await liveSim(page);
    await expectNoA11yViolations(page, { label: "learn sim preview playing" });
  });

  test("inspector: Enter and click open it, desktop shows a side panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const root = await liveSim(page);
    await root.getByRole("button", { name: "Pause" }).click();
    await root.locator('[data-node="db"]').click();
    const panel = root.getByRole("complementary", { name: /Database.*details/ });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Source of truth");
    const [pb, cb] = await Promise.all([
      panel.boundingBox(),
      root.getByRole("group", { name: /diagram/ }).boundingBox(),
    ]);
    expect(pb!.x).toBeGreaterThan(cb!.x + cb!.width - 1); // right of the canvas, not overlaid
    await expect(panel).not.toHaveCSS("position", "fixed");
    await expectNoA11yViolations(page, { label: "learn sim inspector open desktop" });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(root.locator('[data-node="db"]')).toBeFocused();
  });

  test("inspector: mobile shows a bottom sheet that traps focus and returns it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const root = await liveSim(page);
    await root.getByRole("button", { name: "Pause" }).click();
    const node = root.locator('[data-node="cache"]');
    await node.focus();
    await page.keyboard.press("Enter");
    const sheet = root.getByRole("complementary", { name: /Cache.*details/ });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS("position", "fixed");
    const box = await sheet.boundingBox();
    expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(799); // anchored to the bottom
    const close = root.getByRole("button", { name: "Close" });
    await expect(close).toBeFocused();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await expect(sheet.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Shift+Tab");
    await expect(sheet.locator(":focus")).toHaveCount(1);
    await expectNoA11yViolations(page, { label: "learn sim inspector open mobile" });
    await close.click();
    await expect(sheet).toHaveCount(0);
    await expect(node).toBeFocused();
  });

  test("scenario select restarts; decision node shows the chosen branch", async ({ page }) => {
    const root = await liveSim(page, '[data-sim="decision-fixture"]');
    await root.getByRole("button", { name: "Pause" }).click();
    await root.getByRole("button", { name: "Restart" }).click();
    const hit = root.locator('[data-node="hit"]');
    await expect(hit).not.toContainText(/yes|no/);
    await root.getByTestId("sim-steps").getByRole("button").first().click();
    await expect(hit).toContainText("yes");
    await root.getByLabel("Scenario").selectOption("no");
    await expect(root.getByTestId("sim-caption")).toContainText("Step 0 of 1"); // restarted
    await expect(hit).not.toContainText(/yes|no/);
    await root.getByRole("button", { name: "Step forward" }).click();
    await expect(hit).toContainText("no");
    await expect(hit).not.toContainText("yes");
  });

  test("reduced motion: inspector and widgets add no transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const root = await liveSim(page);
    await root.locator('[data-node="cache"]').click();
    const sheet = root.getByRole("complementary", { name: /Cache.*details/ });
    await expect(sheet).toBeVisible();
    const none = /^(0s|1e-05s|0\.00001s)$/; // reduced motion clamps durations to ~0.01ms
    await expect(root.locator("g.transition-transform").first()).toHaveCSS(
      "transition-duration",
      none,
    );
    await expect(sheet).toHaveCSS("animation-duration", none);
    await expectNoA11yViolations(page, { label: "learn sim inspector reduced motion" });
  });
});
