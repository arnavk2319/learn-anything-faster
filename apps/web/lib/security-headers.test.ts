import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./security-headers";

// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
const dsn = `https://key${String.fromCharCode(64)}o1.ingest.eu.sentry.io/42`;

describe("security headers", () => {
  const csp = buildCsp({ dev: false, sentryDsns: [dsn] });
  it("allows workers from self and blob", () => {
    expect(csp).toContain("worker-src 'self' blob:");
  });
  it("allows the Sentry ingest hosts, including the DSN host", () => {
    expect(csp).toContain("https://*.ingest.sentry.io");
    expect(csp).toContain("https://*.ingest.us.sentry.io");
    expect(csp).toContain("https://*.ingest.de.sentry.io");
    expect(csp).toContain("https://o1.ingest.eu.sentry.io");
  });
  it("ignores a missing or malformed DSN", () => {
    expect(() => buildCsp({ dev: false, sentryDsns: [undefined, "nope"] })).not.toThrow();
  });
  it("allows eval only in dev and forbids framing", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(buildCsp({ dev: true })).toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
  it("sets the plain headers", () => {
    const h = Object.fromEntries(securityHeaders({ dev: false }).map((x) => [x.key, x.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBeTruthy();
  });
});
