import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-049. Fixtures: e2e/fixtures/learn (system-design live, ai-engineering coming-soon; the other
// three coming-soon tracks come from the constant list).
const KEY = "laf:learn:v1";
const WIDTHS = [375, 768, 1024, 1280];

const overflow = (page: Page) =>
  page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  ) as Promise<number>;

test.describe("learn landing", () => {
  test("bubbles: live and four coming soon, counts in words, trust line, tag", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1, name: "Learn" })).toBeVisible();
    const bubbles = page.getByRole("list", { name: "Tracks" });
    await expect(bubbles.getByRole("link", { name: /System design/ })).toContainText(
      /\d+ concepts?, \d+ problems?, \d+ questions?/,
    );
    for (const t of [
      "AI engineering",
      "Software architecture",
      "Data engineering",
      "Frontend engineering",
    ]) {
      const g = bubbles.getByRole("group", { name: `${t}, coming soon` });
      await expect(g).toContainText("Coming soon");
      await expect(g).not.toContainText(/\d+ (concepts?|problems?|questions?)/);
    }
    await expect(bubbles.getByText("Added by us")).toBeVisible();
    const trust = await page.getByTestId("trust-line").innerText();
    expect(trust).toMatch(/checked by a person/);
    expect(trust).not.toMatch(
      /\b(19|20)\d\d\b|January|February|March|April|May|June|July|August|September|October|November|December/,
    );
    await expectNoA11yViolations(page, { label: "learn landing bubbles" });
  });

  test("list view is a keyboard-reachable table; mobile falls back to list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/learn");
    await page.getByRole("button", { name: "List" }).click();
    const table = page.getByRole("table", { name: "Tracks" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row", { name: /System design/ })).toContainText(/\d+ concepts?/);
    await expect(table.getByRole("row", { name: /AI engineering/ })).not.toContainText(
      /\d+ concepts?/,
    );
    await table.getByRole("link", { name: "System design" }).focus();
    await expect(table.getByRole("link", { name: "System design" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(table.getByRole("button", { name: "Favorite System design" })).toBeFocused();
    await expectNoA11yViolations(page, { label: "learn landing list" });

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/learn");
    await expect(page.getByRole("table", { name: "Tracks" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Tracks" })).toBeHidden();
  });

  test("filters work off the progress module and live in the URL", async ({ page }) => {
    await page.goto("/learn");
    const tracks = page.getByRole("list", { name: "Tracks" });
    await page.getByRole("button", { name: "Soon", exact: true }).click();
    await expect(page).toHaveURL(/filter=soon/);
    await expect(tracks.getByRole("link", { name: /System design/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Live", exact: true }).click();
    await expect(tracks.getByRole("group")).toHaveCount(0);
    await page.getByRole("button", { name: "Favorites" }).click();
    await expect(page.getByText("No tracks match")).toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await tracks.getByRole("button", { name: "Favorite System design" }).click();
    await page.getByRole("button", { name: "Favorites" }).click();
    await expect(tracks.getByRole("link", { name: /System design/ })).toBeVisible();
    await page.getByRole("button", { name: "In progress" }).click();
    await expect(page.getByText("No tracks match")).toBeVisible();
    await page.evaluate((k) => {
      const p = JSON.parse(localStorage.getItem(k) ?? "{}");
      p.items = { caching: { seenAt: 1 } };
      localStorage.setItem(k, JSON.stringify(p));
    }, KEY);
    await page.reload();
    await expect(page.getByRole("button", { name: "In progress" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("list", { name: "Tracks" }).getByRole("link", { name: /System design/ }),
    ).toBeVisible();
    // back/forward restores; invalid values fall back to All
    await page.goBack();
    await expect(page.getByRole("button", { name: "Favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.goto("/learn?filter=nonsense");
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("search index is not fetched on load, is fetched on first focus; results; ?q restores", async ({
    page,
  }) => {
    const hits: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("search-index.json")) hits.push(r.url());
    });
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    expect(hits).toHaveLength(0);
    const input = page.getByRole("searchbox");
    await input.focus();
    await expect.poll(() => hits.length).toBe(1);
    await input.fill("cach");
    const results = page.getByRole("region", { name: "Search results" });
    await expect(results.getByRole("link", { name: /Caching/ }).first()).toBeVisible();
    await expect(page).toHaveURL(/q=cach/);
    await expectNoA11yViolations(page, { label: "learn landing search results" });
    await page.reload();
    await expect(page.getByRole("searchbox")).toHaveValue("cach");
    await expect(
      page.getByRole("region", { name: "Search results" }).getByRole("link").first(),
    ).toBeVisible();
  });

  test("reduced motion removes the bubble float", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = () =>
      page
        .locator(".bubble-float")
        .first()
        .evaluate("(el) => getComputedStyle(el).animationName") as Promise<string>;
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/learn");
    expect(await name()).toBe("bubble-float");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await name()).toBe("none");
  });

  test("header Learn link navigates to /learn", async ({ page }) => {
    await page.goto("/roadmaps");
    await page.getByRole("banner").getByRole("link", { name: "Learn", exact: true }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Learn", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("touch targets are at least 44px at 375", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/learn");
    const targets = [
      page.getByRole("searchbox"),
      page.getByRole("button", { name: "Bubbles" }),
      page.getByRole("button", { name: "List" }),
      ...["All", "Live", "Soon", "Favorites", "In progress"].map((n) =>
        page.getByRole("button", { name: n, exact: true }),
      ),
      page.getByRole("table", { name: "Tracks" }).getByRole("link", { name: "System design" }),
    ];
    for (const t of targets) {
      const b = await t.boundingBox();
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(43.5);
    }
    await page.getByRole("button", { name: "Bubbles" }).click();
    const bubble = await page
      .getByRole("list", { name: "Tracks" })
      .getByRole("link", { name: /System design/ })
      .boundingBox();
    expect(bubble?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("no horizontal scroll at 375, 768, 1024, 1280", async ({ page }) => {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/learn");
      expect(await overflow(page), `width ${w}`).toBeLessThanOrEqual(0);
    }
  });

  test("reset my progress clears everything, locally only", async ({ page }) => {
    await page.goto("/learn");
    await page.evaluate((k) => {
      localStorage.setItem(
        k,
        JSON.stringify({
          v: 1,
          favorites: {
            tracks: ["system-design"],
            concepts: ["caching"],
            problems: [],
            questions: [],
          },
          items: { caching: { seenAt: 1 } },
          answers: { q1: { correct: true, at: 1 } },
        }),
      );
    }, KEY);
    await page.reload();
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") posts.push(r.url());
    });
    await page.getByRole("button", { name: "Reset my progress" }).click();
    await expect(page.getByText(/stored only on this device/)).toBeVisible();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByRole("status").filter({ hasText: "cleared" })).toBeVisible();
    const p = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), KEY);
    expect(p.favorites).toEqual({ tracks: [], concepts: [], problems: [], questions: [] });
    expect(p.items).toEqual({});
    expect(p.answers).toEqual({});
    expect(p.last).toBeUndefined();
    expect(posts).toEqual([]);
  });
});
