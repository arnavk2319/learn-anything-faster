import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkBot, createRateLimiter, guard } from "./guard";
import { FAIL_SECRET_KEY } from "./turnstile-keys";

const ctx = { ip: "1.1.1.1", action: "transition", token: "tok", host: "app.test" };
const reply = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("checkBot", () => {
  it("passes when siteverify says success, sending only secret, token and idempotency key", async () => {
    const f = reply({ success: true });
    vi.stubGlobal("fetch", f);
    expect(await checkBot(ctx)).toBe(true);
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const sent = [...(init?.body as URLSearchParams).keys()].sort();
    expect(sent).toEqual(["idempotency_key", "response", "secret"]);
  });
  it("fails on success:false (always-fail secret)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", FAIL_SECRET_KEY);
    vi.stubGlobal("fetch", reply({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await checkBot(ctx)).toBe(false);
  });
  it("fails on network error, timeout, non-2xx and bad JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    expect(await checkBot(ctx)).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    expect(await checkBot(ctx)).toBe(false);
    vi.stubGlobal("fetch", reply({ success: true }, 500));
    expect(await checkBot(ctx)).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json")),
    );
    expect(await checkBot(ctx)).toBe(false);
  });
  it("fails with a missing token without calling Cloudflare", async () => {
    const f = reply({ success: true });
    vi.stubGlobal("fetch", f);
    expect(await checkBot({ ...ctx, token: "" })).toBe(false);
    expect(await checkBot({ ip: "1", action: "x" })).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("checks hostname and action with a real secret", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
    vi.stubGlobal("fetch", reply({ success: true, hostname: "app.test", action: "transition" }));
    expect(await checkBot(ctx)).toBe(true);
    vi.stubGlobal("fetch", reply({ success: true, hostname: "evil.test", action: "transition" }));
    expect(await checkBot(ctx)).toBe(false);
    vi.stubGlobal("fetch", reply({ success: true, hostname: "app.test", action: "suggestion" }));
    expect(await checkBot(ctx)).toBe(false);
  });
  it("production without a secret is blocked and makes zero fetch calls", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const f = reply({ success: true });
    vi.stubGlobal("fetch", f);
    expect(await checkBot(ctx)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("guard", () => {
  it("returns blocked before touching the limiter, then rate_limited, then ok", async () => {
    const limiter = vi.fn(createRateLimiter(1, 1000));
    vi.stubGlobal("fetch", reply({ success: false }));
    expect(await guard(ctx, limiter)).toBe("blocked");
    expect(limiter).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", reply({ success: true }));
    expect(await guard(ctx, limiter)).toBe("ok");
    expect(await guard(ctx, limiter)).toBe("rate_limited");
  });
});
