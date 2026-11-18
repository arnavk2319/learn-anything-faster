import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clientIp } from "../../apps/web/lib/forms/client-ip";
import { createDbLimiter } from "../../apps/web/lib/forms/rate-limit-db";
import { formDbFromPg } from "../../apps/web/lib/forms/service";
import { handleFeedback, type FeedbackDeps } from "../../apps/web/lib/learn/feedback/handler";
import { hashClientId } from "../../apps/web/lib/learn/feedback/schemas";
import { closePool, dropSchema, isDbAvailable, resetSchema } from "./harness";

const URL =
  process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:54329/laf_test";
const DIR = join(process.cwd(), "apps/web/db/migrations");
const WINDOW = 600_000;
const CLIENT = "3f2b1c4e-5a6d-4e8f-9a0b-1c2d3e4f5a6b";
const NOTE = "secret-note-text-zzq";
const IP = "9.8.7.6";

describe.skipIf(!isDbAvailable())("POST /api/learn/feedback against Postgres", () => {
  let schema: string;
  let pool: pg.Pool;
  let reports: string[];
  let limit = 30;

  const deps = (over: Partial<FeedbackDeps> = {}): FeedbackDeps => {
    const db = formDbFromPg(pool);
    return {
      db: async () => db,
      limiter: createDbLimiter(db, limit, WINDOW, { random: () => 1 }),
      targetExists: (t, k, id) => t === "t1" && k === "concept" && id === "c1",
      clientIp,
      report: (stage, cls) => void reports.push(`${stage}:${cls}`),
      windowMs: WINDOW,
      random: () => 1,
      ...over,
    };
  };
  const post = (body: unknown, headers: Record<string, string> = {}, d = deps()) =>
    handleFeedback(
      new Request("http://site.test/api/learn/feedback", {
        method: "POST",
        headers: {
          origin: "http://site.test",
          "content-type": "application/json",
          "x-vercel-forwarded-for": IP,
          ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      d,
    );
  const vote = (over: Record<string, unknown> = {}) => ({
    clientId: CLIENT,
    trackId: "t1",
    targetKind: "concept",
    targetId: "c1",
    rating: 5,
    ...over,
  });
  const rows = async () =>
    (await pool.query("select * from learn_feedback order by client_hash")).rows;

  beforeAll(async () => {
    const r = await resetSchema();
    schema = r.schema;
    const ups = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
      .sort();
    for (const f of ups) {
      const t = readFileSync(join(DIR, f), "utf8").replaceAll('"public".', `"${schema}".`);
      for (const s of t.split("--> statement-breakpoint")) if (s.trim()) await r.client.query(s);
    }
    r.client.release();
    pool = new pg.Pool({ connectionString: URL, max: 10, options: `-c search_path=${schema}` });
  });
  afterAll(async () => {
    await pool.end();
    await dropSchema(schema);
    await closePool();
  });
  const reset = async () => {
    reports = [];
    limit = 30;
    await pool.query("delete from learn_feedback");
    await pool.query("delete from rate_limits");
  };

  it("valid vote returns only {ok:true}, stores a hash, no raw id or IP", async () => {
    await reset();
    const res = await post(vote());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].client_hash).toBe(hashClientId(CLIENT));
    expect(JSON.stringify(r)).not.toContain(CLIENT);
    expect(JSON.stringify(r)).not.toContain(IP);
    const rl = await pool.query("select key from rate_limits");
    expect(JSON.stringify(rl.rows)).not.toContain(IP);
  });

  it("repeat converges, changing the vote updates, retract deletes", async () => {
    await reset();
    await post(vote());
    await post(vote());
    expect(await rows()).toHaveLength(1);
    await post(vote({ rating: 1, note: `  ${NOTE} ` }));
    let r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].rating).toBe(1);
    expect(r[0].note).toBe(NOTE);
    await post(vote({ rating: 5, note: NOTE })); // note dropped with rating 5
    r = await rows();
    expect(r[0].note).toBeNull();
    const del = await post(vote({ rating: null }));
    expect(await del.json()).toEqual({ ok: true });
    expect(await rows()).toHaveLength(0);
  });

  it("concurrent identical votes leave one row", async () => {
    await reset();
    await Promise.all(Array.from({ length: 10 }, () => post(vote())));
    expect(await rows()).toHaveLength(1);
  });

  it("the 31st request in a window is 429 with Retry-After", async () => {
    await reset();
    limit = 3;
    const d = deps();
    const codes: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 4; i++) {
      last = await post(vote(), {}, d);
      codes.push(last.status);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await last!.json()).toEqual({ error: "rate_limited" });
  });

  it("invalid input does not burn a limiter slot", async () => {
    await reset();
    limit = 1;
    const d = deps();
    expect((await post(vote({ rating: 3 }), {}, d)).status).toBe(400);
    expect((await post(vote({ targetId: "nope" }), {}, d)).status).toBe(400);
    expect((await post(vote(), {}, d)).status).toBe(200);
  });

  it("403 on missing or foreign origin, writes nothing", async () => {
    await reset();
    expect((await post(vote(), { origin: "http://evil.test" })).status).toBe(403);
    const noOrigin = await handleFeedback(
      new Request("http://site.test/api/learn/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(vote()),
      }),
      deps(),
    );
    expect(noOrigin.status).toBe(403);
    expect(await rows()).toHaveLength(0);
  });

  it("400 for bad body, unknown target, oversize and wrong content type, without echo", async () => {
    await reset();
    const bad = await post(vote({ targetKind: "page", note: NOTE }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid" });
    expect((await post(vote({ targetId: "ghost" }))).status).toBe(400);
    expect((await post(vote({ rating: 1, note: "x".repeat(3000) }))).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect((await post(vote(), { "content-type": "text/plain" })).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("limiter store failure fails open", async () => {
    await reset();
    const broken = createDbLimiter({ execute: () => Promise.reject(new Error("down")) }, 1, WINDOW);
    expect((await post(vote(), {}, deps({ limiter: broken }))).status).toBe(200);
  });

  it("503 when the table is missing, no Sentry report for it", async () => {
    await reset();
    const r = await resetSchema(); // empty schema: no learn_feedback
    const empty = new pg.Pool({
      connectionString: URL,
      max: 2,
      options: `-c search_path=${r.schema}`,
    });
    r.client.release();
    const res = await post(
      vote(),
      {},
      deps({ db: async () => formDbFromPg(empty), limiter: () => true }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    await empty.end();
    await dropSchema(r.schema);
  });

  it("prune-on-write nulls notes older than 180 days only", async () => {
    await reset();
    await post(vote({ rating: 1, note: NOTE }));
    await pool.query("update learn_feedback set updated_at = now() - interval '200 days'");
    await post(
      vote({
        targetId: "c1",
        clientId: "4f2b1c4e-5a6d-4e8f-9a0b-1c2d3e4f5a6b",
        rating: 1,
        note: "fresh",
      }),
      {},
      deps({ random: () => 0 }),
    );
    const r = await rows();
    expect(r.filter((x) => x.note === null)).toHaveLength(1);
    expect(r.filter((x) => x.note === "fresh")).toHaveLength(1);
  });

  it("DB CHECKs reject bad hash, rating and long note", async () => {
    await reset();
    const ins =
      "insert into learn_feedback (track_id,target_kind,target_id,client_hash,rating,note) values ('t','concept','c',$1,$2,$3)";
    const h = "a".repeat(64);
    await expect(pool.query(ins, ["xyz", 5, null])).rejects.toThrow();
    await expect(pool.query(ins, [h, 6, null])).rejects.toThrow();
    await expect(pool.query(ins, [h, 5, "x".repeat(281)])).rejects.toThrow();
    await expect(pool.query(ins, [h, 3, null])).resolves.toBeTruthy();
  });

  it("no raw IP, client id or note appears in logs or error reports", async () => {
    await reset();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await post(vote({ rating: 1, note: NOTE }));
    await post(vote({ rating: 3, note: NOTE }));
    await post(vote(), { origin: "http://evil.test" });
    limit = 1;
    await post(vote());
    const out = JSON.stringify([spies.map((s) => s.mock.calls), reports]);
    spies.forEach((s) => s.mockRestore());
    for (const secret of [NOTE, IP, CLIENT]) expect(out).not.toContain(secret);
  });
});
