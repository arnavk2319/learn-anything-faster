import { expect, test } from "@playwright/test";

test("robots.txt disallows /api/ and points to the sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("sitemap.xml lists the static routes", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(body).toContain("/roadmaps</loc>");
});

test("home page has canonical, Open Graph and Twitter tags; OG image renders", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const attr = (sel: string, a: string) => page.locator(sel).first().getAttribute(a);
  expect(await attr('link[rel="canonical"]', "href")).toMatch(/^https?:\/\//);
  expect(await attr('meta[name="description"]', "content")).toBeTruthy();
  expect(await attr('meta[property="og:title"]', "content")).toBeTruthy();
  expect(await attr('meta[property="og:description"]', "content")).toBeTruthy();
  expect(await attr('meta[name="twitter:card"]', "content")).toBe("summary_large_image");
  const img = await attr('meta[property="og:image"]', "content");
  expect(img).toBeTruthy();
  const res = await request.get(new URL(img!).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});
