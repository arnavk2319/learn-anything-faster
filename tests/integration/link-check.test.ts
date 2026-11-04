import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleLinkCheck } from "../../apps/web/lib/linkcheck/http";
import { runLinkCheck, type Deps, type LinkDb } from "../../apps/web/lib/linkcheck/service";
import { roadmapDbFromPg } from "../../apps/web/lib/roadmap/service";
import { seedContent } from "../../scripts/lib/content/seed.ts";
import { validateContent } from "../../scripts/lib/content/validate.ts";
import { res, validFixture, writeFixture } from "../fixtures/content-fixture.ts";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const DIR = join(process.cwd(), "apps/web/db/migrations");
const PUBLIC = async () => [{ address: "93.184.216.34", family: 4 }];

describe.skipIf(!isDbAvailable())("link-check cron", () => {
  let client: pg.PoolClient;
  let schema: string;
  const db = () => roadmapDbFromPg(client) as unknown as LinkDb;
  const row = async (id: string) =>
    (await client.query("select status, last_checked_at from resources where id=$1", [id]))
      .rows[0] as {
      status: string;
      last_checked_at: Date | null;
    };

  const fetchBy = (statuses: Record<string, number | "throw">): Deps["fetch"] =>
    vi.fn(async (u: string | URL | Request) => {
      const host = new URL(String(u)).hostname.split(".")[0]!;
      const s = statuses[host];
      if (s === "throw") throw new Error("timeout");
      return new Response(null, { status: s ?? 200 });
    }) as unknown as typeof fetch;
  const deps = (f: Deps["fetch"], limits?: Deps["limits"]): Deps => ({
    fetch: f,
    lookup: PUBLIC,
    now: Date.now,
    limits,
  });

  async function reload() {
    await client.query("update resources set status='proposed' where id not like 'r-%'");
    await client.query(
      "update resources set status='approved', last_checked_at=null where id like 'r-%'",
    );
    await client.query("update resources set status='proposed' where id='r-proposed'");
    await client.query("update resources set status='dead' where id='r-dead'");
    await client.query("update resources set url = 'https://' || id || '.example.test/'");
  }

  beforeAll(async () => {
    ({ client, schema } = await resetSchema());
    const ups = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
      .sort();
    for (const f of ups) {
      const sql = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await client.query(s);
    }
    const f = validFixture();
    const stats = res("stats", "approved");
    const base = stats.resources[0]!;
    stats.resources = ["r-live", "r-gone", "r-flaky", "r-proposed", "r-dead"].map((id, i) => ({
      ...base,
      id,
      url: `https://example.com/${i}`,
      status: "approved" as const,
    }));
    f.resources.stats = stats;
    await seedContent(client, validateContent(writeFixture(f)).content);
  });
  afterAll(async () => {
    client.release();
    await dropSchema(schema);
    await closePool();
  });

  it("dead sets status and timestamp, live sets timestamp only, inconclusive writes nothing", async () => {
    await reload();
    const f = fetchBy({ "r-live": 200, "r-gone": 404, "r-flaky": "throw" });
    const out = await runLinkCheck(db(), deps(f));
    expect(out).toMatchObject({ checked: 3, live: 1, dead: 1, inconclusive: 1, skipped: 0 });
    expect(out.deadIds).toEqual(["r-gone"]);
    expect(out.inconclusiveIds).toEqual(["r-flaky"]);
    expect(JSON.stringify(out)).not.toContain("example.test");
    const live = await row("r-live");
    expect(live.status).toBe("approved");
    expect(live.last_checked_at).not.toBeNull();
    const gone = await row("r-gone");
    expect(gone.status).toBe("dead");
    expect(gone.last_checked_at).not.toBeNull();
    expect(await row("r-flaky")).toEqual({ status: "approved", last_checked_at: null });
  });

  it("never touches proposed or dead rows and never promotes", async () => {
    await reload();
    const f = fetchBy({});
    await runLinkCheck(db(), deps(f));
    expect(await row("r-proposed")).toEqual({ status: "proposed", last_checked_at: null });
    expect(await row("r-dead")).toEqual({ status: "dead", last_checked_at: null });
    const hosts = vi.mocked(f).mock.calls.map((c) => new URL(String(c[0])).hostname);
    expect(hosts).not.toContain("r-proposed.example.test");
    expect(hosts).not.toContain("r-dead.example.test");
  });

  it("honours the row limit and checks never-checked rows first", async () => {
    await reload();
    await client.query("update resources set last_checked_at = now() where id='r-live'");
    const out = await runLinkCheck(db(), deps(fetchBy({}), { rows: 2 }));
    expect(out.checked).toBe(2);
    expect((await row("r-live")).last_checked_at).not.toBeNull();
    const unchecked = await client.query(
      "select count(*)::int as n from resources where status='approved' and last_checked_at is null",
    );
    expect(unchecked.rows[0].n).toBe(0); // the 2 never-checked rows ran; r-live was already stamped
  });

  it("honours the concurrency cap", async () => {
    await reload();
    let inflight = 0;
    let peak = 0;
    const f = vi.fn(async () => {
      inflight++;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 15));
      inflight--;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    await runLinkCheck(db(), deps(f, { concurrency: 2 }));
    expect(peak).toBe(2);
  });

  it("stops starting checks after the deadline and reports skipped", async () => {
    await reload();
    let t = 0;
    const d: Deps = { ...deps(fetchBy({})), now: () => (t += 30_000), limits: { concurrency: 1 } };
    const out = await runLinkCheck(db(), d);
    expect(out.skipped).toBeGreaterThan(0);
    expect(out.checked + out.skipped).toBe(3);
  });

  it("a private-address URL is inconclusive, not dead, with no fetch", async () => {
    await reload();
    await client.query("update resources set url='http://169.254.169.254/' where id='r-gone'");
    const f = fetchBy({});
    const out = await runLinkCheck(db(), deps(f));
    expect(out.inconclusiveIds).toContain("r-gone");
    expect((await row("r-gone")).status).toBe("approved");
  });

  it("route handler: 401 without secret does no work; with secret returns counts and ids only", async () => {
    await reload();
    const f = fetchBy({ "r-gone": 410 });
    const get = (auth?: string) =>
      handleLinkCheck(
        new Request("http://x/api/cron/link-check", {
          headers: auth ? { authorization: auth } : {},
        }),
        "s3cret",
        async () => db(),
        deps(f),
      );
    expect((await get()).status).toBe(401);
    expect((await get("Bearer nope")).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ok = await get("Bearer s3cret");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const text = await ok.text();
    expect(JSON.parse(text).deadIds).toEqual(["r-gone"]);
    expect(text).not.toMatch(/example\.test|https?:/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toMatch(/example\.test|https?:/);
    warn.mockRestore();
  });
});
