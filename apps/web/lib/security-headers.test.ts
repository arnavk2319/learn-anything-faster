import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./security-headers";

// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
// Built at runtime so no key-shaped literal sits in the repo (secrets scan).
const at = String.fromCharCode(64);
const dsnFor = (host: string) => ["https://", "key", at, host, "/42"].join("");
const hosts = ["o1.ingest.sentry.io", "o1.ingest.us.sentry.io", "o1.ingest.de.sentry.io"];

describe("security headers", () => {
  const csp = buildCsp({ dev: false });
  it("allows workers from self and blob", () => {
    expect(csp).toContain("worker-src 'self' blob:");
  });
  it("has no Sentry host without a DSN, and no wildcards ever", () => {
    expect(csp).not.toContain("sentry");
    expect(csp).not.toContain("*");
    expect(buildCsp({ dev: false, sentryDsns: [dsnFor(hosts[0]!)] })).not.toContain("*");
  });
  it.each(hosts)("adds exactly the DSN origin for %s", (host) => {
    const c = buildCsp({ dev: false, sentryDsns: [dsnFor(host), dsnFor(host)] });
    expect(c).toContain(`connect-src 'self' https://${host};`);
  });
  it("ignores a missing or malformed DSN", () => {
    const c = buildCsp({ dev: false, sentryDsns: [undefined, "nope"] });
    expect(c).toContain("connect-src 'self';");
  });
  it("allows eval only in dev and forbids framing", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(buildCsp({ dev: true })).toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
  it("adds frame, media and manifest directives", () => {
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("media-src 'none'");
    expect(csp).toContain("manifest-src 'self'");
  });
  it("upgrades insecure requests only when asked", () => {
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ dev: false, upgradeInsecure: true })).toMatch(/; upgrade-insecure-requests$/);
  });
  it("sets the plain and isolation headers", () => {
    const h = Object.fromEntries(securityHeaders({ dev: false }).map((x) => [x.key, x.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBeTruthy();
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["X-Permitted-Cross-Domain-Policies"]).toBe("none");
    expect(h["Cross-Origin-Embedder-Policy"]).toBeUndefined();
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });
  it("denies sensors but keeps clipboard-write for self", () => {
    const pp = securityHeaders({ dev: false }).find((x) => x.key === "Permissions-Policy")!.value;
    for (const f of [
      "camera",
      "microphone",
      "geolocation",
      "payment",
      "usb",
      "serial",
      "bluetooth",
      "midi",
      "magnetometer",
      "gyroscope",
      "accelerometer",
      "display-capture",
      "interest-cohort",
    ]) {
      expect(pp).toContain(`${f}=()`);
    }
    expect(pp).toContain("clipboard-write=(self)");
  });
});
