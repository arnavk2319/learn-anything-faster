import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";
import { mountCombobox } from "./helpers/mount-combobox.ts";

// T-072. Mounts the component through e2e/helpers/mount-combobox.ts (no app route).
const field = (page: Page) => page.getByRole("combobox", { name: "I want to be a" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountCombobox(page);
});

test("keyboard: arrows wrap, Home/End, Enter selects, Escape keeps focus, Tab closes", async ({
  page,
}) => {
  const f = field(page);
  await f.focus();
  await f.press("ArrowDown");
  await expect(f).toHaveAttribute("aria-expanded", "true");
  const opts = page.getByRole("option");
  await expect(opts).toHaveCount(4);
  await expect(f).not.toHaveAttribute("aria-activedescendant", /.+/); // first ArrowDown only opens
  await f.press("ArrowDown");
  await expect(f).toHaveAttribute("aria-activedescendant", (await opts.nth(0).getAttribute("id"))!);
  await f.press("ArrowUp");
  await expect(f).toHaveAttribute("aria-activedescendant", (await opts.nth(3).getAttribute("id"))!);
  await f.press("Home");
  await expect(f).toHaveAttribute("aria-activedescendant", (await opts.nth(0).getAttribute("id"))!);
  await f.press("End");
  await expect(f).toHaveAttribute("aria-activedescendant", (await opts.nth(3).getAttribute("id"))!);
  await f.press("Escape");
  await expect(f).toHaveAttribute("aria-expanded", "false");
  await expect(f).toBeFocused();
  await f.press("ArrowDown"); // reopens, none active
  await f.press("ArrowDown");
  await f.press("ArrowDown");
  await f.press("Enter");
  await expect(f).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("value")).toHaveText("ml");
  await expect(f).toHaveValue("ML engineer");
  await f.press("ArrowDown");
  await f.press("Tab");
  await expect(f).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("value")).toHaveText("ml");
});

test("type-ahead narrows, Enter selects first match, clearing restores", async ({ page }) => {
  const f = field(page);
  await f.click();
  await f.fill("ml e");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option", { name: "ML engineer" })).toBeVisible();
  await f.fill("");
  await expect(page.getByRole("option")).toHaveCount(4);
  await f.fill("ml e");
  await f.press("Enter");
  await expect(page.getByTestId("value")).toHaveText("ml");
});

test("sizes, names, selected and coming-soon rows", async ({ page }) => {
  const f = field(page);
  expect((await f.locator("..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await f.click();
  for (const o of await page.getByRole("option").all()) {
    expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const soon = page.getByRole("option", { name: "MLOps engineer, coming soon, get notified" });
  await expect(soon).toContainText(/get notified/i);
  await expect(soon).not.toHaveAttribute("aria-disabled", /.*/);
  await expect(page.getByRole("group", { name: "Available now" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Coming soon" })).toBeVisible();
  await soon.click();
  await expect(page.getByTestId("value")).toHaveText("mlops");
  await expect(f).toBeFocused();
  await f.click();
  const sel = page.getByRole("option", { selected: true });
  await expect(sel).toContainText("Selected");
  await expect(sel).toHaveAttribute("aria-selected", "true");
});

test("axe: open and empty result", async ({ page }) => {
  const f = field(page);
  await f.click();
  await expectNoA11yViolations(page, { label: "combobox open" });
  await f.fill("zzz");
  await expect(page.getByRole("status")).toContainText("No roles match");
  await expectNoA11yViolations(page, { label: "combobox empty" });
});

test("375px: bottom sheet, no horizontal scroll, focus stays on field after close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const f = field(page);
  await f.click();
  const box = (await page.getByTestId("role-panel").boundingBox())!;
  expect(box.x).toBe(0);
  expect(Math.round(box.width)).toBe(375);
  const over = (await page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  )) as number;
  expect(over).toBe(0);
  await f.press("Escape");
  await expect(f).toBeFocused();
});
