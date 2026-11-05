import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => sentry(...a) }));

import { createDbLimiter, hashKey } from "./rate-limit-db";
import { reportLimiterError } from "./rate-limit-report";
import { guard } from "./guard";

const ctx = { ip: "9.9.9.9", action: "transition", token: "tok" };
const row = (count: number) => ({
  rows: [{ key: "a".repeat(64), windowStart: new Date(), count }],
});

beforeEach(() => {
  sentry.mockReset();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ success: true }))),
  );
});

describe("createDbLimiter", () => {
  it("allows while count <= limit and blocks above it", async () => {
    let n = 0;
    const l = createDbLimiter({ execute: async () => row(++n) }, 2, 600_000, { random: () => 1 });
    expect([await l("k"), await l("k"), await l("k")]).toEqual([true, true, false]);
  });
  it("hashes the key", () => {
    expect(hashKey("t:1.2.3.4")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey("t:1.2.3.4")).not.toContain("1.2.3.4");
  });
  it("fails open, reports to Sentry with the tag, and does not log the key or ip", async () => {
    const db = {
      execute: async () => {
        throw new Error("connection refused");
      },
    };
    const l = createDbLimiter(db, 1, 600_000, { onError: reportLimiterError });
    expect(await guard(ctx, l)).toBe("ok");
    expect(sentry).toHaveBeenCalledTimes(1);
    const [err, opts] = sentry.mock.calls[0] as [Error, { tags: Record<string, string> }];
    expect(opts.tags).toEqual({ rate_limiter: "store_error" });
    expect(JSON.stringify([err.message, opts])).not.toContain("9.9.9.9");
  });
  it("fails open on a malformed row", async () => {
    const l = createDbLimiter({ execute: async () => ({ rows: [] }) }, 1, 600_000, {
      onError: reportLimiterError,
    });
    expect(await l("k")).toBe(true);
    expect(sentry).toHaveBeenCalledTimes(1);
  });
  it("a prune failure does not affect the result or report", async () => {
    let calls = 0;
    const db = {
      execute: async () => {
        if (++calls === 2) throw new Error("prune boom");
        return row(1);
      },
    };
    const l = createDbLimiter(db, 1, 600_000, { random: () => 0, onError: reportLimiterError });
    expect(await l("k")).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sentry).not.toHaveBeenCalled();
  });
});
