// T-018 security sweep, static invariants. These read source so that a NEW form or server action that skips the
// bot check, the shared DB rate limiter, or Zod validation fails here instead of shipping. Runtime behaviour is
// covered by tests/integration (forms, rate-limit, roadmap-api) and e2e/security.spec.ts.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp } from "../../apps/web/lib/security-headers.ts";

const web = join(process.cwd(), "apps/web");
const read = (p: string) => readFileSync(join(web, p), "utf8");
const actions = read("app/actions/forms.ts");
const service = read("lib/forms/service.ts");

describe("every form write passes the guard", () => {
  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  const submitters = [...service.matchAll(/export async function (submit\w+)/g)].map((m) => m[1]);

  it("has the two known server actions and service writers (a new one must be added here)", () => {
    expect(exported.sort()).toEqual(["requestTransitionAction", "suggestResourceAction"]);
    expect(submitters.sort()).toEqual(["submitResourceSuggestion", "submitTransitionRequest"]);
  });

  it("each service writer validates with Zod, then calls guard, before any insert", () => {
    for (const name of submitters) {
      const body = service.slice(service.indexOf(`function ${name}`));
      const end = body.indexOf("\nexport ", 10);
      const fn = end > 0 ? body.slice(0, end) : body;
      const parse = fn.indexOf(".safeParse(");
      const guard = fn.indexOf("await guard(");
      const insert = fn.indexOf(".insert(");
      expect(parse, name).toBeGreaterThan(-1);
      expect(guard, name).toBeGreaterThan(parse);
      expect(insert, name).toBeGreaterThan(guard);
    }
  });

  it("each server action uses the shared Postgres limiter and sends the Turnstile token", () => {
    expect(actions.match(/createDbLimiter\(/g)?.length).toBe(exported.length);
    expect(actions).toContain('"cf-turnstile-response"');
    expect(actions).not.toMatch(/createRateLimiter/); // the in-memory limiter is per instance, tests only
  });

  it("each form component renders the Turnstile widget", () => {
    const dir = join(web, "components/forms");
    const forms = readdirSync(dir).filter((f) => /Form\.tsx$/.test(f));
    expect(forms.length).toBeGreaterThanOrEqual(2);
    for (const f of forms)
      expect(readFileSync(join(dir, f), "utf8"), f).toContain("<TurnstileWidget");
  });
});

describe("response shapes carry no email", () => {
  it("FormResult never includes an email field", () => {
    const schemas = read("lib/forms/schemas.ts");
    const result = schemas.slice(schemas.indexOf("FormResult"));
    expect(result).not.toMatch(/email/i);
  });
  it("API routes never select an email column", () => {
    for (const p of [
      "app/api/roadmap/route.ts",
      "app/api/health/route.ts",
      "app/api/cron/link-check/route.ts",
    ])
      expect(read(p), p).not.toMatch(/email/i);
  });
});

describe("CSP", () => {
  const csp = buildCsp({ dev: false });
  it("allows the Turnstile origin only for scripts and frames, and no analytics origin", () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com;");
    expect(csp).not.toMatch(/posthog|ingest/i);
    expect(csp).not.toContain("unsafe-eval");
  });
});
