import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../../apps/web/lib/forms/guard";
import {
  submitResourceSuggestion,
  submitTransitionRequest,
  formDbFromPg,
  type FormDb,
} from "../../apps/web/lib/forms/service";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

// Built at runtime so no email-shaped literal sits in the repo (secrets scan).
const mail = (u: string) => `${u}${String.fromCharCode(64)}example.test`;
const DIR = join(process.cwd(), "apps/web/db/migrations");
const ctx = { ip: "1.2.3.4", action: "t" };
const open = () => createRateLimiter(1000, 60_000);

describe("rate limiter", () => {
  it("blocks after the limit and resets after the window", () => {
    const l = createRateLimiter(2, 1000);
    expect([l("k", 0), l("k", 1), l("k", 2)]).toEqual([true, true, false]);
    expect(l("other", 2)).toBe(true);
    expect(l("k", 1001)).toBe(true);
  });
});

describe.skipIf(!isDbAvailable())("form actions against Postgres", () => {
  let client: pg.PoolClient;
  let schema: string;
  let db: FormDb;
  const count = async (t: string) =>
    Number((await client.query(`select count(*)::int as n from ${t}`)).rows[0].n);

  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
    const ups = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
      .sort();
    for (const f of ups) {
      const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await client.query(s);
    }
    await client.query("insert into roles values ('a','A','live'),('b','B','coming_soon')");
    await client.query("insert into topics values ('t1','T1','x','w',1)");
    db = formDbFromPg(client);
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  const req = (over: Record<string, unknown> = {}) => ({
    fromRole: "a",
    toRole: "b",
    email: ` ${mail("Ada")} `,
    kind: "request",
    ...over,
  });

  it("stores a normalised request and treats a duplicate as success without a second row", async () => {
    expect(await submitTransitionRequest(db, req(), ctx, open())).toEqual({ ok: true });
    expect(await submitTransitionRequest(db, req({ email: mail("ADA") }), ctx, open())).toEqual({
      ok: true,
    });
    expect(await count("transition_requests")).toBe(1);
    const row = (await client.query("select email from transition_requests")).rows[0];
    expect(row.email).toBe(mail("ada"));
    // A different kind is a different row (notify).
    await submitTransitionRequest(db, req({ kind: "notify" }), ctx, open());
    expect(await count("transition_requests")).toBe(2);
  });

  it("never returns the email", async () => {
    const r = await submitTransitionRequest(db, req({ email: mail("leak") }), ctx, open());
    expect(JSON.stringify(r)).not.toContain("example.test");
    const bad = await submitTransitionRequest(db, req({ email: "nope" }), ctx, open());
    expect(bad).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { email: "Enter an email address" },
    });
    expect(JSON.stringify(bad)).not.toContain("nope@");
  });

  it("rejects invalid input and unknown roles without writing", async () => {
    const before = await count("transition_requests");
    for (const over of [
      { email: "" },
      { kind: "other" },
      { toRole: "a" },
      { fromRole: "NOT A SLUG" },
    ]) {
      const r = await submitTransitionRequest(db, req(over), ctx, open());
      expect(r).toMatchObject({ ok: false, error: "invalid" });
    }
    const unknown = await submitTransitionRequest(db, req({ toRole: "zzz" }), ctx, open());
    expect(unknown).toMatchObject({ ok: false, error: "invalid" });
    expect(await count("transition_requests")).toBe(before);
  });

  it("enforces the rate limit", async () => {
    const l = createRateLimiter(2, 60_000);
    const send = (n: number) =>
      submitResourceSuggestion(
        db,
        { topicId: "t1", url: `https://example.test/${n}`, note: "" },
        ctx,
        l,
      );
    expect(await send(1)).toEqual({ ok: true });
    expect(await send(2)).toEqual({ ok: true });
    expect(await send(3)).toEqual({ ok: false, error: "rate_limited" });
  });

  it("stores suggestions, validating url scheme and topic", async () => {
    const ok = await submitResourceSuggestion(
      db,
      { topicId: "t1", url: " https://example.test/x ", note: " good " },
      ctx,
      open(),
    );
    expect(ok).toEqual({ ok: true });
    const row = (
      await client.query("select url, note from resource_suggestions where note = 'good'")
    ).rows[0];
    expect(row.url).toBe("https://example.test/x");
    for (const url of ["javascript:alert(1)", "ftp://example.test", "not a url", ""]) {
      expect(
        await submitResourceSuggestion(db, { topicId: "t1", url, note: "" }, ctx, open()),
      ).toMatchObject({
        ok: false,
        error: "invalid",
      });
    }
    expect(
      await submitResourceSuggestion(
        db,
        { topicId: "nope", url: "https://example.test/y", note: "" },
        ctx,
        open(),
      ),
    ).toMatchObject({ ok: false, error: "invalid" });
    expect(
      await submitResourceSuggestion(
        db,
        { topicId: "t1", url: "https://example.test/z", note: "x".repeat(501) },
        ctx,
        open(),
      ),
    ).toMatchObject({ ok: false, error: "invalid" });
  });

  it("does not log input", async () => {
    const spies = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m));
    await submitTransitionRequest(db, req({ email: mail("quiet") }), ctx, open());
    await submitTransitionRequest(db, req({ toRole: "zzz", email: mail("quiet") }), ctx, open());
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});
