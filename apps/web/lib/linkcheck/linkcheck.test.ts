import { describe, expect, it, vi } from "vitest";
import { handleLinkCheck, isAuthorized } from "./http";
import { checkUrl, type Deps } from "./service";
import { guardUrl, isBlockedIp, type LookupFn } from "./ssrf";

const PUBLIC: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

function deps(
  fetchImpl: (url: string, init?: RequestInit) => Response | Promise<Response>,
  lookup = PUBLIC,
): Deps {
  return {
    fetch: vi.fn(async (u, i) => fetchImpl(String(u), i)) as unknown as typeof fetch,
    lookup,
    now: Date.now,
  };
}
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "198.18.0.1",
    "198.19.255.1",
    "192.0.0.8",
    "64:ff9b::7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::1",
    "2002::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "172.32.0.1",
    "192.0.2.1",
    "198.20.0.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("guardUrl", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest",
    "http://[::1]/",
    ["https://user", "pw"].join(":") + "@example.com/",
    "https://example.com:8443/",
    "not a url",
  ])("blocks %s", async (u) => {
    expect(await guardUrl(u, PUBLIC)).toEqual({ ok: false, reason: "blocked" });
  });
  it("blocks a host that resolves to a private address", async () => {
    const r = await guardUrl("https://evil.test/", async () => [
      { address: "10.0.0.5", family: 4 },
    ]);
    expect(r).toEqual({ ok: false, reason: "blocked" });
  });
  it("reports ENOTFOUND as notfound", async () => {
    const r = await guardUrl("https://gone.test/", async () => {
      throw Object.assign(new Error("x"), { code: "ENOTFOUND" });
    });
    expect(r).toEqual({ ok: false, reason: "notfound" });
  });
});

describe("checkUrl", () => {
  it("200 is live, 404 and 410 are dead", async () => {
    expect(
      await checkUrl(
        "https://a.test/",
        deps(() => new Response(null, { status: 200 })),
      ),
    ).toBe("live");
    expect(
      await checkUrl(
        "https://a.test/",
        deps(() => new Response(null, { status: 404 })),
      ),
    ).toBe("dead");
    expect(
      await checkUrl(
        "https://a.test/",
        deps(() => new Response(null, { status: 410 })),
      ),
    ).toBe("dead");
  });
  it("5xx, 429, 403 and thrown errors are inconclusive", async () => {
    for (const status of [500, 503, 429, 403, 401])
      expect(
        await checkUrl(
          "https://a.test/",
          deps(() => new Response(null, { status })),
        ),
      ).toBe("inconclusive");
    expect(
      await checkUrl(
        "https://a.test/",
        deps(() => {
          throw new Error("timeout");
        }),
      ),
    ).toBe("inconclusive");
  });
  it("falls back to GET when HEAD is 405", async () => {
    const d = deps((_u, i) => new Response(null, { status: i?.method === "HEAD" ? 405 : 200 }));
    expect(await checkUrl("https://a.test/", d)).toBe("live");
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });
  it("follows a redirect to a live page and uses manual redirects", async () => {
    const d = deps((u) =>
      u === "https://a.test/" ? redirect("https://b.test/x") : new Response(null, { status: 200 }),
    );
    expect(await checkUrl("https://a.test/", d)).toBe("live");
    expect(vi.mocked(d.fetch).mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });
  it("does not follow a redirect to a private address", async () => {
    const d = deps((u) =>
      u === "https://a.test/"
        ? redirect("http://169.254.169.254/")
        : new Response(null, { status: 200 }),
    );
    expect(await checkUrl("https://a.test/", d)).toBe("inconclusive");
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });
  it("redirect loops stop after 3 hops", async () => {
    const d = deps(() => redirect("https://a.test/"));
    expect(await checkUrl("https://a.test/", d)).toBe("inconclusive");
    expect(d.fetch).toHaveBeenCalledTimes(4);
  });
  it("blocked schemes never reach fetch", async () => {
    for (const u of ["file:///etc/passwd", "http://127.0.0.1/"]) {
      const d = deps(() => new Response(null, { status: 200 }));
      expect(await checkUrl(u, d)).toBe("inconclusive");
      expect(d.fetch).not.toHaveBeenCalled();
    }
  });
  it("ENOTFOUND on the original host is dead", async () => {
    const d = deps(
      () => new Response(null, { status: 200 }),
      async () => {
        throw Object.assign(new Error("x"), { code: "ENOTFOUND" });
      },
    );
    expect(await checkUrl("https://gone.test/", d)).toBe("dead");
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe("per-URL budget", () => {
  it("aborts a slow lookup and a slow fetch within the budget", async () => {
    const never = new Promise<never>(() => undefined);
    const slowLookup = deps(
      () => new Response(null, { status: 200 }),
      () => never,
    );
    slowLookup.limits = { urlBudgetMs: 30 };
    const t0 = Date.now();
    expect(await checkUrl("https://a.test/", slowLookup)).toBe("inconclusive");
    const slowFetch = deps(
      (_u, i) =>
        new Promise<Response>((_r, rej) =>
          i?.signal?.addEventListener("abort", () => rej(new Error("aborted"))),
        ),
    );
    slowFetch.limits = { urlBudgetMs: 30, timeoutMs: 60_000 };
    expect(await checkUrl("https://a.test/", slowFetch)).toBe("inconclusive");
    expect(Date.now() - t0).toBeLessThan(2_000);
  });
  it("one budget covers all hops", async () => {
    const d = deps(
      (_u, i) =>
        new Promise<Response>((res, rej) => {
          const t = setTimeout(() => res(redirect("https://a.test/")), 20);
          i?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            rej(new Error("aborted"));
          });
        }),
    );
    d.limits = { urlBudgetMs: 50 };
    expect(await checkUrl("https://a.test/", d)).toBe("inconclusive");
    expect(vi.mocked(d.fetch).mock.calls.length).toBeLessThan(4);
  });
});

describe("auth", () => {
  it("isAuthorized fails closed", () => {
    expect(isAuthorized("Bearer s", "s")).toBe(true);
    expect(isAuthorized("Bearer x", "s")).toBe(false);
    expect(isAuthorized(null, "s")).toBe(false);
    expect(isAuthorized("Bearer ", "")).toBe(false);
    expect(isAuthorized("Bearer undefined", undefined)).toBe(false);
  });
  it("401 with no db or network work for missing, wrong and unset secret", async () => {
    const d = deps(() => new Response(null, { status: 200 }));
    const getDb = vi.fn(async () => {
      throw new Error("db touched");
    });
    const cases: [string | undefined, string | undefined][] = [
      ["s", undefined],
      ["s", "Bearer wrong"],
      [undefined, "Bearer anything"],
      ["", "Bearer "],
    ];
    for (const [secret, auth] of cases) {
      const req = new Request("http://x/api/cron/link-check", {
        headers: auth ? { authorization: auth } : {},
      });
      const r = await handleLinkCheck(req, secret, getDb, d);
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ error: "unauthorized" });
    }
    expect(getDb).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });
});
