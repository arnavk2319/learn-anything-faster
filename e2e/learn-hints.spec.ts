import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-094 hints. Fixture q-caching-6 has a hint; q-caching-4 has none (generic fallback).
const CONCEPT = "/learn/system-design/concepts/caching";
const HINT = "Ask which data would make a cache wrong or wasteful";
const GENERIC = "Reread the section above, then look at each option again.";

test.use({ viewport: { width: 1280, height: 800 } });

async function wrong(
  page: Page,
  qid: string,
  option: string,
  role: "radio" | "checkbox" = "radio",
) {
  const card = page.locator(`[data-question="${qid}"]`);
  await card.getByRole(role, { name: option }).check();
  await expect(card.getByRole("button", { name: "Check" })).toBeEnabled();
  await card.getByRole("button", { name: "Check" }).click();
  await expect(card.getByRole("status")).toContainText("Not quite.");
  return card;
}

test.describe("learn hints", () => {
  test("Hint shows the authored hint; a question without one shows the generic text", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    const withHint = await wrong(page, "q-caching-6", "Hot, frequently read data", "checkbox");
    await withHint.getByRole("button", { name: "Hint" }).click();
    await expect(withHint.getByTestId("hint")).toContainText(HINT);
    const without = await wrong(page, "q-caching-4", "2 times");
    await without.getByRole("button", { name: "Hint" }).click();
    await expect(without.getByTestId("hint")).toHaveText(GENERIC);
  });

  test("server HTML carries no hint; the static JSON does", async ({ request }) => {
    const html = await (await request.get(CONCEPT)).text();
    expect(html).not.toContain(HINT);
    const json = (await (await request.get("/learn/system-design/quiz/caching")).json()) as {
      id: string;
      hint?: string;
    }[];
    expect(json.find((e) => e.id === "q-caching-6")?.hint).toContain(HINT);
    expect(json.find((e) => e.id === "q-caching-4")?.hint).toBeUndefined();
  });

  test("keyboard: Hint reveals by Enter, retry still works; axe clean with hint open", async ({
    page,
  }) => {
    await page.goto(CONCEPT);
    const card = await wrong(page, "q-caching-6", "Hot, frequently read data", "checkbox");
    const hintBtn = card.getByRole("button", { name: "Hint" });
    await hintBtn.focus();
    await page.keyboard.press("Enter");
    await expect(card.getByTestId("hint")).toContainText(HINT);
    await expectNoA11yViolations(page, { label: "learn hint open" });
    await card.getByRole("button", { name: "Try again" }).focus();
    await page.keyboard.press("Enter");
    await expect(card.getByTestId("hint")).toHaveCount(0);
    await expect(
      card.getByRole("checkbox", { name: "Hot, frequently read data" }),
    ).not.toBeChecked();
  });
});
