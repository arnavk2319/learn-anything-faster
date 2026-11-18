import { expect, test, type Page, type Route } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-085. Anonymous feedback UI (ADR-0017) with the API mocked by route interception.
const CONCEPT = "/learn/system-design/concepts/caching";
const KEY = "laf:learn:fb:v1";

// Browser globals used inside evaluate(); this tsconfig has no DOM lib.
/* eslint-disable @typescript-eslint/no-explicit-any -- evaluate() bodies run in the browser, DOM types are unavailable */
declare const getComputedStyle: (el: any, pseudo?: string) => any;
declare const window: any;
declare const document: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

type Body = Record<string, unknown>;

async function mock(page: Page, status = 200) {
  const bodies: Body[] = [];
  let code = status;
  await page.route("**/api/learn/feedback", async (route: Route) => {
    bodies.push(route.request().postDataJSON() as Body);
    await route.fulfill({
      status: code,
      contentType: "application/json",
      body: JSON.stringify(code === 200 ? { ok: true } : { error: "x" }),
    });
  });
  return { bodies, set: (c: number) => (code = c) };
}

const qIcon = (page: Page) =>
  page
    .locator('[data-testid="question-card"]')
    .first()
    .getByRole("button", { name: /^Feedback on this question/ });

test("one icon per target kind with a 44px hit area; none off Learn pages", async ({ page }) => {
  const m = await mock(page);
  await page.goto(CONCEPT);
  await expect(qIcon(page)).toBeVisible();
  await expect(
    page.locator('[data-slot="sim-feedback"]').first().getByRole("button"),
  ).toHaveAccessibleName(/^Feedback on this simulation/);
  await expect(
    page.getByRole("button", { name: /^Feedback on this section/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Feedback on this concept/ })).toBeVisible();
  const hit = await qIcon(page).evaluate((el) => {
    const a = getComputedStyle(el, "::after");
    return [parseFloat(a.width), parseFloat(a.height)];
  });
  expect(hit[0]).toBeGreaterThanOrEqual(44);
  expect(hit[1]).toBeGreaterThanOrEqual(44);
  expect(m.bodies).toHaveLength(0); // no request on page load
  for (const path of ["/", "/learn"]) {
    await page.goto(path);
    await expect(page.getByTestId("feedback-icon")).toHaveCount(0);
  }
});

test("vote, change, note only after not helpful, retract, restore after reload", async ({
  page,
}) => {
  const m = await mock(page);
  await page.goto(CONCEPT);
  await qIcon(page).click();
  const panel = page.getByTestId("feedback-panel");
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await panel.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(page.getByTestId("feedback-status")).toHaveText(/Thanks/);
  expect(m.bodies[0]).toMatchObject({
    rating: 5,
    targetKind: "question",
    trackId: "system-design",
  });
  expect(Object.keys(m.bodies[0]!).sort()).toEqual(
    ["clientId", "rating", "targetId", "targetKind", "trackId"].sort(),
  );
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.locator('[data-testid="question-card"]').first().getByTestId("feedback-icon"),
  ).toHaveAttribute("data-vote", "helpful");

  await panel.getByRole("button", { name: "Not helpful" }).click();
  expect(m.bodies[1]).toMatchObject({ rating: 1 });
  const note = panel.getByRole("textbox");
  await note.fill("x".repeat(300));
  await expect(note).toHaveValue("x".repeat(280));
  await expect(panel).toContainText("0 characters left");
  await note.fill("too fast");
  await panel.getByRole("button", { name: "Send note" }).click();
  await expect(panel.getByRole("button", { name: "Note sent" })).toBeVisible();
  expect(m.bodies[2]).toMatchObject({ rating: 1, note: "too fast" });

  await page.reload();
  await expect(qIcon(page).or(page.locator('[data-vote="not-helpful"]').first())).toBeVisible();
  await expect(
    page.locator('[data-testid="question-card"]').first().getByTestId("feedback-icon"),
  ).toHaveAttribute("data-vote", "not-helpful");
  expect(m.bodies).toHaveLength(3); // reload sent nothing

  await page.locator('[data-testid="question-card"]').first().getByTestId("feedback-icon").click();
  await page.getByRole("button", { name: "Retract" }).click();
  await expect(page.getByTestId("feedback-status")).toHaveText(/removed/);
  expect(m.bodies[3]).toMatchObject({ rating: null });
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(stored).not.toContain('"votes":{"');
  // The client id is never in the DOM.
  const id = JSON.parse(stored!).clientId as string;
  expect(await page.content()).not.toContain(id);
});

test("503 queues the vote (not the note) and retries on the online event", async ({ page }) => {
  const m = await mock(page, 503);
  await page.goto(CONCEPT);
  await qIcon(page).click();
  const panel = page.getByTestId("feedback-panel");
  await panel.getByRole("button", { name: "Not helpful" }).click();
  await expect(page.getByTestId("feedback-status")).toHaveText(/Saved on this device/);
  await panel.getByRole("textbox").fill("secret note");
  await panel.getByRole("button", { name: "Send note" }).click();
  await expect(page.getByTestId("feedback-status")).toHaveText(/Saved on this device|Could not/);
  await expect(panel.getByRole("textbox")).toHaveValue("secret note"); // kept
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(JSON.parse(stored!).queue).toHaveLength(1);
  expect(stored).not.toContain("secret note");

  m.set(200);
  const before = m.bodies.length;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => m.bodies.length).toBeGreaterThan(before);
  await expect
    .poll(
      async () =>
        JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!).queue.length,
    )
    .toBe(0);
  expect(JSON.stringify(m.bodies.slice(before))).not.toContain("secret note");
});

test("429 says to try again in a minute; the vote stays on the icon", async ({ page }) => {
  await mock(page, 429);
  await page.goto(CONCEPT);
  await qIcon(page).click();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(page.getByTestId("feedback-status")).toHaveText(/Try again in a minute/);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("queued votes are retried on the next load", async ({ page }) => {
  const m = await mock(page, 200);
  await page.addInitScript((k) => {
    if (!localStorage.getItem(k))
      localStorage.setItem(
        k,
        JSON.stringify({
          v: 1,
          clientId: "11111111-1111-4111-8111-111111111111",
          votes: {},
          queue: [
            {
              trackId: "system-design",
              targetKind: "sim",
              targetId: "cache-aside-read",
              rating: 5,
              at: Date.now(),
            },
          ],
        }),
      );
  }, KEY);
  await page.goto(CONCEPT);
  await expect.poll(() => m.bodies.length).toBe(1);
  expect(m.bodies[0]).toMatchObject({ targetId: "cache-aside-read", rating: 5 });
});

test("keyboard only: open, vote, Escape returns focus; axe clean with panel open", async ({
  page,
}) => {
  await mock(page);
  await page.goto(CONCEPT);
  const icon = qIcon(page);
  await icon.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("feedback-panel");
  await expect(panel.getByRole("button", { name: "Helpful", exact: true })).toBeFocused();
  await expectNoA11yViolations(page, { label: "feedback panel open" });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("feedback-status")).toHaveText(/Thanks/);
  // Focus stays trapped while open.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((p) => p.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(icon).toBeFocused();
});

test("mobile 390px: bottom sheet, no horizontal overflow; reduced motion has no transition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mock(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(CONCEPT);
  await qIcon(page).scrollIntoViewIfNeeded();
  await qIcon(page).click();
  const panel = page.getByTestId("feedback-panel");
  const b = (await panel.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390 + 1);
  expect(b.y + b.height).toBeGreaterThan(790);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
  expect(
    parseFloat(await panel.evaluate((p) => getComputedStyle(p).transitionDuration)),
  ).toBeLessThan(0.001);
  expect(await panel.evaluate((p) => getComputedStyle(p).animationName)).toBe("none");
});
