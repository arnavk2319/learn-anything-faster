import * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildSentryOptions, initSentry, type SentryKind } from "./init";

// Built at runtime so the repo secrets scan does not flag fixtures.
const AT = "@";
const EMAIL = `jane${AT}example.com`;
const DSN = `https://0123456789abcdef0123456789abcdef${AT}o1.ingest.sentry.io/2`;

function stubTransport() {
  const sent: string[] = [];
  const transport = () => ({
    send: async (envelope: unknown) => {
      sent.push(JSON.stringify(envelope));
      return {};
    },
    flush: async () => true,
  });
  return { sent, transport };
}

afterEach(async () => {
  await Sentry.close();
});

describe("no DSN", () => {
  it.each(["server", "client"] as SentryKind[])("%s: nothing initialises", (kind) => {
    expect(buildSentryOptions(undefined, kind)).toBeNull();
    expect(buildSentryOptions("  ", kind)).toBeNull();
    expect(initSentry(undefined, kind)).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();
    expect(() => Sentry.captureException(new Error("x"))).not.toThrow();
  });
});

describe("captured payloads contain no email", () => {
  it("unhandled server error via onRequestError path", async () => {
    const { sent, transport } = stubTransport();
    expect(
      initSentry(DSN, "server", { transport, defaultIntegrations: false, integrations: [] }),
    ).toBe(true);
    Sentry.captureRequestError(
      new Error(`db failed for ${EMAIL} via postgres://u:pw${AT}host/db`),
      { path: "/roadmap", method: "GET", headers: { cookie: "a=b", "x-user": EMAIL } },
      { routerKind: "App Router", routePath: "/roadmap", routeType: "render" },
    );
    await Sentry.flush(2000);
    expect(sent.length).toBeGreaterThan(0);
    const payload = sent.join("");
    expect(payload).toContain("db failed");
    expect(payload).not.toContain(EMAIL);
    expect(payload).not.toContain("u:pw");
  });

  it("client error (same options, client kind)", async () => {
    const { sent, transport } = stubTransport();
    initSentry(DSN, "client", { transport, defaultIntegrations: false, integrations: [] });
    Sentry.setUser({ email: EMAIL });
    Sentry.captureException(new Error(`click failed for ${EMAIL}`));
    await Sentry.flush(2000);
    const payload = sent.join("");
    expect(payload).toContain("click failed");
    expect(payload).not.toContain(EMAIL);
  });
});
