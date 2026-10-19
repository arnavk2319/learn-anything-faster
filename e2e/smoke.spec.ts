import { test, expect } from "@playwright/test";

test("@smoke home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Learn Anything Faster" })).toBeVisible();
});
