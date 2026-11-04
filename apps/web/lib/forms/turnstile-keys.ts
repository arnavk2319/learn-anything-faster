// Turnstile keys (ADR-0012). Cloudflare's published test keys are used only outside production; in production
// a missing key means "blocked" (fail closed). There is no bypass flag.
export const TEST_SITE_KEY = "1x00000000000000000000AA"; // always passes (visible widget)
export const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA"; // always passes
export const FAIL_SECRET_KEY = "2x0000000000000000000000000000000AA"; // always fails (tests only)

const isProd = () => process.env.NODE_ENV === "production";

/** Public site key for the browser widget; empty string means "not configured" (production only). */
export function siteKey(): string {
  const k = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (k) return k;
  return isProd() ? "" : TEST_SITE_KEY;
}

/** Server secret; empty string means "not configured" (production only). Never log it. */
export function secretKey(): string {
  const k = process.env.TURNSTILE_SECRET_KEY;
  if (k) return k;
  return isProd() ? "" : TEST_SECRET_KEY;
}
