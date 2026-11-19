import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-083 reward layer. Runs against the approved fixture copies (LEARN_CONTENT_DIR).
const CONCEPT = "/learn/system-design/concepts/caching";
const OTHER = "/learn/system-design/concepts/long-label-fixture";
const KEY = "laf:learn:v1";
const Q4 = '[data-question="q-caching-4"]';

test.use({ viewport: { width: 1280, height: 800 } });

async function answer(page: Page, option: string) {
  const card = page.locator(Q4);
  const radio = card.getByRole("radio", { name: option });
  await expect(radio).toBeVisible();
  await radio.check();
  await card.getByRole("button", { name: "Check" }).click();
  return card;
}

const toast = (page: Page) => page.getByTestId("reward-toast");

// Seed a v2 blob, then reload so the page reads it.
async function seed(page: Page, blob: unknown) {
  await page.goto(CONCEPT);
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k as string, v as string),
    [KEY, JSON.stringify(blob)],
  );
  await page.reload();
}

const opened = { "system-design": true as const };
const base = {
  v: 2,
  favorites: { tracks: [], concepts: [], problems: [], questions: [] },
  items: {},
  answers: {},
  firstOpened: opened,
};

test.describe("learn rewards", () => {
  test("correct answer: success toast in a polite region, stamp on the option, no focus steal; Escape dismisses; axe", async ({
    page,
  }) => {
    await seed(page, base);
    const card = await answer(page, "10 times");
    await expect(toast(page)).toContainText("Correct");
    await expect(page.getByTestId("reward-region")).toHaveAttribute("aria-live", "polite");
    await expect(page.getByTestId("reward-region")).toHaveAttribute("role", "status");
    await expect(card.getByTestId("option-stamp")).toBeVisible();
    await expect(page.getByTestId("reward-burst")).toHaveCount(1);
    // Focus stays on the control the learner used, not the toast.
    const inRegion = await page.evaluate(
      `!!document.activeElement?.closest("[data-testid=reward-region]")`,
    );
    expect(inRegion).toBe(false);
    await expectNoA11yViolations(page, { label: "learn reward toast" });
    await page.keyboard.press("Escape");
    await expect(toast(page)).toHaveCount(0);
  });

  test("toast auto-dismisses", async ({ page }) => {
    await seed(page, base);
    await answer(page, "10 times");
    await expect(toast(page)).toBeVisible();
    await expect(toast(page)).toHaveCount(0, { timeout: 7000 });
  });

  test("wrong answer: neutral copy, Hint, unlimited Try again, never reveals, no toast or burst", async ({
    page,
  }) => {
    await seed(page, base);
    const card = await answer(page, "2 times");
    await expect(card.getByRole("status")).toContainText("Not quite.");
    await expect(page.getByTestId("reward-toast")).toHaveCount(0);
    await expect(page.getByTestId("reward-burst")).toHaveCount(0);
    await expect(card.getByTestId("option-stamp")).toHaveCount(0);
    await expect(card.locator("label.border-known-ring")).toHaveCount(0);
    await card.getByRole("button", { name: "Hint" }).click();
    await expect(card.getByTestId("hint")).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await card.getByRole("button", { name: "Try again" }).click();
      await expect(card.getByRole("radio", { name: "2 times" })).not.toBeChecked();
      await card.getByRole("radio", { name: "2 times" }).check();
      await card.getByRole("button", { name: "Check" }).click();
      await expect(card.getByRole("status")).toContainText("Not quite.");
    }
    await card.getByRole("button", { name: "Try again" }).click();
    await card.getByRole("radio", { name: "10 times" }).check();
    await card.getByRole("button", { name: "Check" }).click();
    await expect(card.getByRole("status")).toContainText("Correct.");
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), KEY);
    expect(stored.answers["q-caching-4"].correct).toBe(true);
  });

  test("concept finished fires once and not again after reload", async ({ page }) => {
    const ok = (id: string) => [id, { correct: true, at: 1 }] as const;
    await seed(page, {
      ...base,
      items: { caching: { seenAt: 1 } },
      answers: Object.fromEntries(
        ["q-caching-1", "q-caching-2", "q-caching-3", "q-caching-5", "q-caching-6"].map(ok),
      ),
    });
    await answer(page, "10 times");
    await expect(toast(page)).toHaveAttribute("data-reward", "finished");
    await expect(toast(page)).toContainText("done");
    await page.reload();
    await expect(page.locator(Q4)).toBeVisible();
    await expect(toast(page)).toHaveCount(0);
    await answer(page, "10 times");
    await expect(page.locator(Q4).getByRole("status")).toContainText("Correct.");
    await expect(toast(page)).toHaveCount(0);
  });

  test("first opened fires once per topic, not for a second module", async ({ page }) => {
    await page.goto(CONCEPT);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await page.reload();
    await expect(toast(page)).toHaveAttribute("data-reward", "first-opened");
    await expect(toast(page)).toContainText("New on the trail");
    await expect(page.getByTestId("reward-burst")).toHaveCount(0);
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), KEY);
    expect(stored.firstOpened).toEqual({ "system-design": true });
    await page.goto(OTHER);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(toast(page)).toHaveCount(0);
    await page.goto(CONCEPT);
    await expect(toast(page)).toHaveCount(0);
  });

  test("reduced motion: static toast, no burst, no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, base);
    await answer(page, "10 times");
    await expect(toast(page)).toContainText("Correct");
    await expect(page.getByTestId("reward-burst")).toHaveCount(0);
    const anim = await page.evaluate(
      `getComputedStyle(document.querySelector("[data-testid=reward-stamp]")).animationName`,
    );
    expect(anim).toBe("none");
  });

  test("Celebrations off removes the stamp and burst but keeps the toast", async ({ page }) => {
    await seed(page, base);
    await page.getByLabel("Celebrations").uncheck();
    await answer(page, "10 times");
    await expect(toast(page)).toContainText("Correct");
    await expect(page.getByTestId("reward-stamp")).toHaveCount(0);
    await expect(page.getByTestId("reward-burst")).toHaveCount(0);
  });
});
