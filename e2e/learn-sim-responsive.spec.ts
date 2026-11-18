import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.ts";

// T-090. The sim picks a vertical layout in panes <= 480px and the wide layout above, with no sideways scroll.
const PREVIEW = "/learn/sim-preview";
const CONCEPT = "/learn/system-design/concepts/caching";
const TEMPLATES = [
  "cache-aside",
  "cache-aside-read",
  "cache-aside-write",
  "load-balancer",
  "leader-follower",
  "producer-consumer",
  "consistent-hash-ring",
  "sharded-lookup",
];

const pin = (page: Page) =>
  page.addInitScript(
    `localStorage.setItem("laf:ui:v1", JSON.stringify({ v: 1, rail: 0.01, rightCollapsed: true }))`,
  );

async function liveSim(page: Page, id: string) {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  const root = page.locator(`#${id} [data-sim]`);
  await expect(page.locator(`#${id} [data-sim-island="live"]`)).toBeVisible();
  await expect(root.getByRole("button", { name: /^(Play|Pause)$/ })).toBeEnabled();
  return root;
}

const metrics = (page: Page, id: string) =>
  page.evaluate(`(() => {
    const svg = document.querySelector('#${id} [role="group"] > svg');
    const canvas = svg.parentElement;
    const vb = svg.viewBox.baseVal;
    const scale = svg.getBoundingClientRect().width / vb.width;
    return {
      svg: svg.getBoundingClientRect().width,
      canvas: canvas.clientWidth,
      layout: svg.getAttribute("data-layout"),
      labels: [...svg.querySelectorAll("text")].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale),
    };
  })()`) as Promise<{ svg: number; canvas: number; layout: string; labels: number[] }>;

test.describe("sim layout per pane width", () => {
  test("390: every template sim is the vertical layout, fills the pane, labels >= 11px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PREVIEW);
    for (const id of TEMPLATES) {
      if ((await page.locator(`#${id}`).count()) === 0) continue;
      await liveSim(page, id);
      const m = await metrics(page, id);
      expect(m.layout, id).toBe("narrow");
      expect(Math.abs(m.svg - m.canvas), id).toBeLessThanOrEqual(4);
      expect(m.labels.length, id).toBeGreaterThan(0);
      for (const s of m.labels) expect(s, id).toBeGreaterThanOrEqual(11);
    }
  });

  test("1280 preview: wide layout fills the pane with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PREVIEW);
    await liveSim(page, "cache-aside");
    const m = await metrics(page, "cache-aside");
    expect(m.layout).toBe("wide");
    expect(Math.abs(m.svg - m.canvas)).toBeLessThanOrEqual(4);
  });

  for (const w of [1280, 390]) {
    test(`${w}: no horizontal scroll in the sim canvas or its ancestors up to the card`, async ({
      page,
    }) => {
      await pin(page);
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(CONCEPT);
      await page.locator("[data-sim-island]").first().scrollIntoViewIfNeeded();
      await expect(page.locator('[data-sim-island="live"]').first()).toBeVisible();
      const over = await page.evaluate(`(() => {
        const canvas = document.querySelector('[data-sim] [role="group"][tabindex="0"]');
        let el = canvas;
        const bad = [];
        while (el && !el.hasAttribute("data-sim")) {
          // Only scrollers count; visible overflow (such as a 44px hit-area pseudo-element) cannot scroll.
          const scrolls = /auto|scroll/.test(getComputedStyle(el).overflowX);
          if ((scrolls || el === canvas) && el.scrollWidth > el.clientWidth) bad.push(el.tagName);
          el = el.parentElement;
        }
        return bad;
      })()`);
      expect(over).toEqual([]);
    });
  }

  test("resizing across 480px switches layout and keeps scenario, playhead and inspector", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(PREVIEW);
    const root = await liveSim(page, "decision-fixture");
    expect((await metrics(page, "decision-fixture")).layout).toBe("narrow");
    await root.getByLabel("Scenario").selectOption("no");
    await root.getByRole("button", { name: "Pause" }).click();
    await root.getByRole("group", { name: /diagram/ }).focus();
    await page.keyboard.press("ArrowRight");
    const caption = root.getByTestId("sim-caption");
    await expect(caption).toContainText("Step 1 of");
    const before = await caption.innerText();
    await root.locator('[data-node="db"]').click();
    await expect(page.getByRole("complementary", { name: /Database.*details/ })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(async () => (await metrics(page, "decision-fixture")).layout).toBe("wide");
    await expect(root.getByLabel("Scenario")).toHaveValue("no");
    await expect(caption).toHaveText(before);
    await expect(page.getByRole("complementary", { name: /Database.*details/ })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(async () => (await metrics(page, "decision-fixture")).layout).toBe("narrow");
    await expect(caption).toHaveText(before);
  });

  for (const [w, mode] of [
    [390, "narrow"],
    [1280, "wide"],
  ] as const) {
    test(`${mode}: axe clean and no transition or animation under reduced motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(PREVIEW);
      await liveSim(page, "cache-aside");
      expect((await metrics(page, "cache-aside")).layout).toBe(mode);
      await expectNoA11yViolations(page, { label: `sim ${mode}`, include: "#cache-aside" });
      const moving =
        await page.evaluate(`[...document.querySelectorAll('#cache-aside [data-sim] *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0.001) ||
            (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.001);
        })
        .map((el) => el.tagName)`);
      expect(moving).toEqual([]);
    });
  }

  test("landing page is unaffected: no sim, no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await expect(page.locator("[data-sim]")).toHaveCount(0);
    expect(
      await page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth",
      ),
    ).toBe(false);
  });
});
