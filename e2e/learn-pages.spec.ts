import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-045. Runs against approved fixture copies of the T-037 sample (LEARN_CONTENT_DIR, see playwright.config.ts).
const CONCEPT = "/learn/system-design/concepts/caching";
const PROBLEM = "/learn/system-design/problems/url-shortener";
const KEY = "laf:learn:v1";

test.describe("learn concept and problem pages", () => {
  test("concept page renders blocks, level anchors and cross-links; axe clean", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();
    for (const id of ["basic", "intermediate", "advanced"]) {
      await expect(page.locator(`section#${id}`)).toBeAttached();
    }
    await page.goto(`${CONCEPT}#advanced`);
    await expect(page.locator("section#advanced h2")).toBeInViewport();
    await expect(page.locator("table").first()).toBeVisible();
    await expect(page.locator('[data-sim="cache-aside-read"]')).toBeVisible();
    await expectNoA11yViolations(page, { label: "learn concept" });
    // T-079: the shell outline and next-up also link here, so scope to the in-page Related nav.
    await page
      .getByRole("navigation", { name: "Related" })
      .getByRole("link", { name: "URL shortener" })
      .click();
    await expect(page).toHaveURL(PROBLEM);
    await expect(page.getByRole("heading", { level: 1, name: "URL shortener" })).toBeVisible();
    await expectNoA11yViolations(page, { label: "learn problem" });
    await page
      .getByRole("navigation", { name: "Related" })
      .getByRole("link", { name: "Caching" })
      .click();
    await expect(page).toHaveURL(CONCEPT);
  });

  test("proposed and unknown items return 404", async ({ request }) => {
    for (const path of [
      "/learn/system-design/concepts/draft-topic",
      "/learn/system-design/concepts/nope",
      "/learn/system-design/problems/nope",
      "/learn/nope/concepts/caching",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("the mcq answer is not in the server HTML, only in the static JSON", async ({ request }) => {
    const html = await (await request.get(CONCEPT)).text();
    const json = (await (await request.get("/learn/system-design/quiz/caching")).json()) as {
      id: string;
      explanation: string;
    }[];
    const q = json.find((e) => e.id === "q-caching-4");
    expect(q?.explanation).toBeTruthy();
    expect(html).not.toContain(q!.explanation);
    expect(html).toContain("data-question="); // prompts and options are in the HTML
  });

  test("quick check works by keyboard and records the answer", async ({ page }) => {
    await page.goto(CONCEPT);
    const card = page.locator('[data-question="q-caching-4"]');
    await expect(card).toBeVisible();
    // Wait for hydration: the radio is controlled, so Space only sticks once React has attached.
    const right = card.getByRole("radio", { name: "10 times" });
    await right.focus();
    await page.keyboard.press("Space");
    await expect(right).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Check" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("status")).toContainText("Correct.");
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), KEY);
    expect(stored.answers["q-caching-4"].correct).toBe(true);
    expect(stored.items.caching.seenAt).toBeTruthy();
    await expectNoA11yViolations(page, { label: "learn quick check answered" });
  });

  test("a wrong answer shows the explanation and Try again", async ({ page }) => {
    await page.goto(CONCEPT);
    const card = page.locator('[data-question="q-caching-4"]');
    const wrong = card.getByRole("radio", { name: "2 times" });
    await wrong.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(card.getByRole("status")).toContainText("Not quite.");
    await card.getByRole("button", { name: "Try again" }).click();
    await expect(card.getByRole("radio", { name: "2 times" })).not.toBeChecked();
  });

  test("short-explain self-grade on the problem page", async ({ page }) => {
    await page.goto(PROBLEM);
    const card = page.locator('[data-question="q-url-shortener-1"]');
    await card.getByRole("button", { name: "Show model answer" }).click();
    await card.getByRole("button", { name: "I got it" }).click();
    await expect(card.getByRole("status")).toContainText("Marked as got it.");
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), KEY);
    expect(stored.answers["q-url-shortener-1"]).toMatchObject({ correct: true, selfGraded: true });
  });
});
