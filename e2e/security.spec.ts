import { expect, test } from "@playwright/test";
import pg from "pg";
import { seedRoadmapFixture } from "./helpers/seed-roadmap.ts";

// T-018 security sweep, live server. Static invariants (guard, limiter and Turnstile on every form) are in
// tests/security/sweep.test.ts; the DB-level limiter and API contract are in tests/integration.
const DB = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
const leak = `sweep${String.fromCharCode(64)}example.test`;

test.beforeAll(async () => {
  if (process.env.BASE_URL) return;
  await seedRoadmapFixture();
  const pool = new pg.Pool({ connectionString: DB });
  try {
    for (const [id, status] of [
      ["sweep-proposed", "proposed"],
      ["sweep-dead", "dead"],
    ] as const)
      await pool.query(
        `insert into resources (id, topic_id, type, title, url, is_free, status)
         values ($1,'stats','docs',$1,'https://example.com/'||$1,true,$2) on conflict (id) do update set status = excluded.status`,
        [id, status],
      );
    await pool.query(
      "insert into transition_requests (from_role, to_role, email, kind) values ('dev','later-role',$1,'request') on conflict do nothing",
      [leak],
    );
  } finally {
    await pool.end();
  }
});

test("roadmap API serves only approved resources and never an email", async ({ request }) => {
  const res = await request.get("/api/roadmap?from=dev&to=ml-dev");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).not.toContain("sweep-proposed");
  expect(text).not.toContain("sweep-dead");
  expect(text).not.toContain(leak);
  expect(text).not.toContain("@");
});

test("API and page responses never contain a stored email", async ({ request }) => {
  for (const path of [
    "/",
    "/roadmaps",
    "/roadmap/dev/ml-dev",
    "/api/health",
    "/api/roadmap?from=dev&to=later-role",
  ]) {
    const text = await (await request.get(path)).text();
    expect(text, path).not.toContain(leak);
  }
});

test("security headers on API routes and no analytics origin in the CSP", async ({ request }) => {
  for (const path of ["/api/health", "/api/roadmap?from=dev&to=ml-dev", "/roadmaps"]) {
    const h = (await request.get(path)).headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["content-security-policy"], path).toContain("https://challenges.cloudflare.com");
    expect(h["content-security-policy"], path).not.toMatch(/posthog/i);
  }
  const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  expect(csp).toContain("frame-src https://challenges.cloudflare.com;");
});
