import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-061: topic panel polish (plain labels, 44px close, no middle dot, Free/Paid word).
test.beforeAll(seedRoadmapFixture);

const topic = (page: Page, id: string) => page.locator(`button[data-topic-id="${id}"]`);
const panelOf = (page: Page) => page.getByTestId("topic-panel");

// Adds a paid resource next to the seeded free one so both words are asserted.
async function withPaidResource(page: Page) {
  await page.route("**/api/roadmap**", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    for (const n of json.nodes)
      if (n.id === "torch")
        n.resources.push({
          ...n.resources[0],
          id: "paid-extra",
          title: "Paid extra course",
          isFree: false,
        });
    await route.fulfill({ response: res, json });
  });
}

for (const view of ["graph", "list"] as const) {
  test(`${view} view: plain labels, no old labels, no middle dot, Free/Paid words`, async ({
    page,
  }) => {
    await withPaidResource(page);
    await page.goto(`/roadmap/dev/ml-dev?view=${view}`);
    await topic(page, "torch").click();
    const panel = panelOf(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Learn these first", { exact: true })).toBeVisible();
    await expect(panel.getByText("Opens up", { exact: true })).toBeVisible();
    await expect(panel.getByText("End of this branch")).toBeVisible();
    await expect(panel.getByText("Needs first")).toHaveCount(0);
    await expect(panel.getByText("Unlocks")).toHaveCount(0);
    const free = panel.getByRole("link", { name: /torch docs/ });
    const paid = panel.getByRole("link", { name: /Paid extra course/ });
    await expect(free).toContainText("Free");
    await expect(paid).toContainText("Paid");
    for (const l of await panel.getByRole("link").all())
      expect(await l.innerText()).not.toContain(" · ");
    await expect(free).toContainText("(opens in a new tab)");
    await panel.getByRole("button", { name: "Stats" }).click();
    await panel.getByRole("button", { name: "Algebra" }).click(); // a root topic has no prerequisites
    await expect(panel.getByText("Nothing, start here")).toBeVisible();
    await topic(page, "torch").click();
    await expectNoA11yViolations(page, { label: `panel ${view}` });
  });
}

for (const width of [375, 768, 1024, 1280]) {
  test(`close target is 44x44, closes by click and Escape, returns focus, no h-scroll at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/roadmap/dev/ml-dev");
    await expect(topic(page, "torch")).toBeVisible();
    await topic(page, "torch").focus();
    await page.keyboard.press("Enter");
    const panel = panelOf(page);
    const close = panel.getByRole("button", { name: "Close panel" });
    const box = (await close.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
    await expectNoA11yViolations(page, { label: `panel open ${width}` });
    await close.click();
    await expect(panel).toHaveCount(0);
    await expect(topic(page, "torch")).toBeFocused();
    await topic(page, "torch").press("Enter");
    await expect(panelOf(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panelOf(page)).toHaveCount(0);
    await expect(topic(page, "torch")).toBeFocused();
  });
}
