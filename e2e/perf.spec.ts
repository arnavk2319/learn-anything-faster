import { expect, test } from "@playwright/test";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-018 perf: the launch roadmap graph is visible in about 1 s and a role change feels instant (NFRs).
// Bounds are loose enough for CI and `next dev`; the route is warmed first so on-demand compilation is not timed.
// Real figures are recorded in the ticket Findings.
test.beforeAll(seedRoadmapFixture);

test("launch roadmap graph is visible in about 1 s once warm", async ({ page, request }) => {
  await request.get("/roadmap/dev/ml-dev");
  await request.get("/api/roadmap?from=dev&to=ml-dev");
  const t0 = Date.now();
  await page.goto("/roadmap/dev/ml-dev");
  await expect(page.locator('button[data-topic-id="stats"]')).toBeVisible({ timeout: 3000 });
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: "graph-visible-ms", description: String(ms) });
  expect(ms).toBeLessThan(3000);
});

test("changing the current role re-renders quickly without a reload", async ({ page }) => {
  await page.goto("/roadmap/dev/ml-dev");
  await expect(page.locator('button[data-topic-id="algebra"]')).toBeVisible();
  // Prime the other role's data so the timed change measures the UI, not a cold server compile.
  await page.getByLabel("Current role").selectOption("dev2");
  await expect(page.locator('button[data-topic-id="algebra"]')).toHaveCount(0);
  await page.getByLabel("Current role").selectOption("dev");
  await expect(page.locator('button[data-topic-id="algebra"]')).toBeVisible();
  const t0 = Date.now();
  await page.getByLabel("Current role").selectOption("dev2");
  await expect(page.locator('button[data-topic-id="algebra"]')).toHaveCount(0, { timeout: 2000 });
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: "role-change-ms", description: String(ms) });
  expect(ms).toBeLessThan(1500);
});
