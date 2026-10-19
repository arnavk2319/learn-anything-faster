import { describe, it } from "vitest";

describe("security checks pending code (T-022)", () => {
  it.todo("no API response contains an email address (needs T-007/T-014/T-018)");
  it.todo("only approved resources are served by any endpoint (needs T-007/T-014/T-018)");
  it.todo(
    "security headers present on all routes: HSTS, X-Content-Type-Options, Referrer-Policy (needs T-007/T-014/T-018)",
  );
  it.todo("CSP header set and forbids inline script without nonce (needs T-007/T-014/T-018)");
  it.todo("Turnstile verified on every form submission (needs T-007/T-014/T-018)");
  it.todo(
    "input validation (Zod) rejects malformed input on every form and server action (needs T-007/T-014/T-018)",
  );
  it.todo("rate limits return 429 past the threshold on write endpoints (needs T-007/T-014/T-018)");
});
