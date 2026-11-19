import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-092. Fixture system-design: approved caching 75 min + url-shortener 60 min (the proposed draft-topic
// carries 500 min and must not count) = 135 min -> "About 2 hours".
test("track overview shows hours only, axe clean, no overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/learn/system-design");
  const time = page.getByTestId("track-time");
  await expect(time).toHaveText("About 2 hours");
  await expect(page.getByTestId("track-counts")).toHaveText(/^\d+ concepts?, \d+ problems?$/);
  await expectNoA11yViolations(page, { label: "track time" });
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(time).toBeVisible();
  const overflow = (await page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  )) as number;
  expect(overflow).toBeLessThanOrEqual(0);
});
