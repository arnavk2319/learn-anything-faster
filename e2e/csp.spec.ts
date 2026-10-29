import { expect, test, type Page } from "@playwright/test";

// T-025: security headers are present, and the CSP does not break the page, the graph or the ELK worker.
// Run against a production build for a faithful check: pnpm build, then BASE_URL=http://localhost:3100 with `next start`.
async function watchViolations(page: Page) {
  await page.addInitScript(`
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push(e.violatedDirective + " " + e.blockedURI);
    });
  `);
  const consoleCsp: string[] = [];
  page.on("console", (m) => {
    if (/content security policy/i.test(m.text())) consoleCsp.push(m.text());
  });
  // The ELK worker (GWT-compiled) probes eval() once at start-up; the CSP blocks it ("script-src eval") and ELK
  // falls back, with a layout identical to dev (which allows eval; checked by comparing node transforms).
  // We deliberately do not add 'unsafe-eval' for that, so this single known probe is ignored.
  const known = (v: string) => v === "script-src eval";
  return async () =>
    [...((await page.evaluate("window.__csp")) as string[]), ...consoleCsp].filter(
      (v) => !known(v),
    );
}

test("pages send the security headers", async ({ request }) => {
  for (const path of ["/", "/roadmap/dev/ml-dev"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["content-security-policy"]).toContain("worker-src 'self' blob:");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  }
});

test("landing page loads with no CSP violations", async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await violations()).toEqual([]);
});

test("roadmap graph renders (ELK worker included) with no CSP violations", async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto("/roadmap/dev/ml-dev");
  await expect(page.locator('button[data-topic-id="stats"]')).toBeVisible();
  await expect(page.locator(".react-flow__edge").first()).toBeAttached();
  await page.waitForLoadState("networkidle");
  expect(await violations()).toEqual([]);
});
