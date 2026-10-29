import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for, then x-real-ip, then x-forwarded-for", () => {
    const all = {
      "x-vercel-forwarded-for": "1.1.1.1, 9.9.9.9",
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3, 4.4.4.4",
    };
    expect(clientIp(h(all))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(h({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
  });
  it("falls back to unknown", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});
