import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-081. Track page and /learn inside the Learn shell, compact tier, folded-in T-068 criteria.
// Fixtures: e2e/fixtures/learn (system-design live with 2 approved concepts and 1 problem).
const TRACK = "/learn/system-design";
const WIDTHS = [375, 768, 1024, 1280];
// Recorded before the redesign at 1280x800: first concept row top 407px, row pitch 72px (64 + 8 gap).
const BASELINE_FIT = Math.floor((800 - 407) / 72);

// T-098 (human-approved setup): outline labels are 14px, so the long-label fixture makes the default (100%) rail
// wider and squeezes main at 1280. Start with the rail at its 80% minimum, as a user could drag it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("laf:ui:v1", '{"v":1,"rail":0.8}'));
});

const overflow = (page: Page) =>
  page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  ) as Promise<number>;

test.describe("track page and landing in the shell", () => {
  test("1280x800: no page scroll, main scrolls, compact fonts, rows fit 2x baseline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of ["/learn", TRACK]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      const m = (await page.evaluate(
        `({ sh: document.documentElement.scrollHeight, ih: innerHeight,
            shell: document.querySelector("[data-density=compact]") !== null })`,
      )) as { sh: number; ih: number; shell: boolean };
      expect(m.sh, path).toBe(m.ih);
      expect(m.shell).toBe(true);
    }
    await page.goto(TRACK);
    const rows = page.locator("section#basic ul > li");
    await expect(rows.first()).toBeVisible();
    const boxes = await rows.evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        return { top: b.top, h: b.height };
      }),
    );
    // T-099: concept rows are now cards (about 88px, 64px minimum), so the 44px and 2x-baseline density bound
    // no longer applies to them. Intent kept: cards stay compact and enough still fit the fold.
    expect(boxes[0]!.h).toBeGreaterThanOrEqual(64);
    expect(boxes[0]!.h).toBeLessThanOrEqual(110);
    const pitch = boxes[1]!.top - boxes[0]!.top;
    const fit = Math.floor((800 - boxes[0]!.top) / pitch);
    expect(fit).toBeGreaterThanOrEqual(Math.ceil(BASELINE_FIT / 2));
    const fs = (await page.evaluate(
      `[document.querySelector("[data-density=compact]"), document.querySelector("section#basic li a")].map((e) => getComputedStyle(e).fontSize)`,
    )) as string[];
    expect(fs[0]).toBe("14px");
    expect(["13px", "14px"]).toContain(fs[1]);
  });

  test("Start with X, counts in words, tabs in the URL", async ({ page }) => {
    await page.goto(TRACK);
    await expect(page.getByTestId("track-counts")).toHaveText(/^\d+ concepts?, \d+ problems?$/);
    const start = page.getByTestId("start-with");
    await expect(start).toContainText(/^Start with /);
    const name = (await start.innerText()).replace("Start with ", "");
    await start.click();
    await expect(page).toHaveURL(/\/learn\/system-design\/concepts\/[a-z-]+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.goto(TRACK);
    await page.getByRole("tab", { name: /Problems/ }).click();
    await expect(page).toHaveURL(`${TRACK}/problems`, { timeout: 20_000 });
    await page.reload();
    await expect(page.getByRole("tab", { name: /Problems/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.goBack();
    await expect(page).toHaveURL(TRACK);
    await expect(page.getByRole("tab", { name: /Concepts/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.goForward();
    await expect(page.getByRole("tab", { name: /Problems/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("44px targets at 375", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(TRACK);
    const targets = [
      page.getByRole("tab", { name: /Concepts/ }),
      page.getByRole("tab", { name: /Problems/ }),
      page.getByTestId("start-with"),
      // T-099: the card is the link target (stretched title link), so the li stands in for the link box.
      page.locator("section#basic ul > li").first(),
      page.getByRole("button", { name: "Favorite Caching" }),
    ];
    for (const t of targets) {
      const b = await t.boundingBox();
      expect(b?.height ?? 0, String(t)).toBeGreaterThanOrEqual(43.5);
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(43.5);
    }
  });

  test("390: one pane with the bottom nav; landing too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const path of [TRACK, "/learn"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByTestId("outline-rail")).toBeHidden();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    }
  });

  for (const w of WIDTHS) {
    test(`no horizontal scroll and axe at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of [TRACK, `${TRACK}/problems`, "/learn"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await overflow(page), `${path} @${w}`).toBeLessThanOrEqual(0);
      }
      await page.goto(TRACK);
      await expectNoA11yViolations(page, { label: `track ${w}` });
    });
  }

  test("landing axe in the shell; track rail lists tracks", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/learn");
    await expect(
      page.getByTestId("outline-rail").getByRole("link", { name: "System design" }),
    ).toBeVisible();
    await expectNoA11yViolations(page, { label: "learn landing shell" });
  });
});
