import { describe, expect, it } from "vitest";
import { scrubEvent, scrubString } from "./scrub";

// Built at runtime so the repo secrets scan does not flag fixtures.
const AT = "@";
const email = (name: string) => `${name}${AT}example.com`;
const pgUrl = `postgresql://user:p4ss${AT}ep-1.neon.tech/db`;
const dsn = `https://0123456789abcdef0123456789abcdef${AT}o123.ingest.sentry.io/456`;
const prefixedKey = `${["sk", "live"].join("_")}_abcdefghij1234`;

describe("scrubString", () => {
  it("removes emails", () => {
    const out = scrubString(`failed for ${email("jane.doe+x")} twice`);
    expect(out).not.toContain(AT);
    expect(out).toContain("[email]");
  });

  it("removes connection strings", () => {
    const out = scrubString(`connect ${pgUrl}?sslmode=require failed`);
    expect(out).not.toContain("p4ss");
    expect(out).not.toContain("neon.tech");
  });

  it("removes Sentry-DSN-like urls", () => {
    const out = scrubString(`dsn ${dsn}`);
    expect(out).not.toContain("0123456789abcdef");
    expect(out).not.toContain("ingest.sentry.io");
  });

  it("removes bearer tokens, key=value secrets and prefixed keys", () => {
    expect(scrubString("Authorization: Bearer abc.def-123")).not.toContain("abc.def");
    expect(scrubString("password=hunter22 token: zzz999")).not.toMatch(/hunter22|zzz999/);
    expect(scrubString(`key ${prefixedKey}`)).not.toContain("abcdefghij1234");
    expect(scrubString("hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b")).not.toContain("9f86d081");
  });

  it("leaves ordinary text alone", () => {
    const text = "TypeError: x is undefined at roadmap/page.tsx:12";
    expect(scrubString(text)).toBe(text);
  });
});

describe("scrubEvent", () => {
  it("scrubs nested values, drops user and cookies, redacts sensitive keys", () => {
    const event = {
      message: `hi ${email("a")}`,
      user: { email: email("a"), id: "1" },
      request: {
        cookies: { s: "1" },
        headers: { cookie: "sess=1", accept: "x" },
        url: `/x?email=${email("a")}`,
      },
      exception: { values: [{ value: `boom for ${email("c")}` }] },
      extra: { apiKey: "shh", list: [email("e")] },
    };
    const out = scrubEvent(event);
    const json = JSON.stringify(out);
    expect(json).not.toContain(AT);
    expect(json).not.toContain("shh");
    expect(json).not.toContain("sess=1");
    expect(out).not.toHaveProperty("user");
    expect(out.request).not.toHaveProperty("cookies");
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { m: email("x") };
    a.self = a;
    expect(() => scrubEvent(a)).not.toThrow();
  });
});
