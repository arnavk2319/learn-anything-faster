// Link checker. No model calls. fetch, lookup and clock are injected so tests need no network.
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { resources } from "../../db/schema";
import { guardUrl, type LookupFn } from "./ssrf";

export type LinkDb = Pick<NodePgDatabase, "select" | "update">;
export type Verdict = "live" | "dead" | "inconclusive";

export const LIMITS = {
  rows: 40,
  concurrency: 5,
  timeoutMs: 8_000,
  deadlineMs: 45_000,
  urlBudgetMs: 12_000, // all hops, lookups and HEAD+GET for one URL; 45 s + 12 s stays under maxDuration 60
  maxHops: 3,
} as const;

export type Deps = {
  fetch: typeof fetch;
  lookup: LookupFn;
  now: () => number;
  limits?: Partial<{ [K in keyof typeof LIMITS]: number }>;
};

export type LinkCheckResult = {
  checked: number;
  live: number;
  dead: number;
  inconclusive: number;
  skipped: number;
  deadIds: string[];
  inconclusiveIds: string[];
};

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function request(
  url: URL,
  method: "HEAD" | "GET",
  d: Deps,
  timeoutMs: number,
  budget: AbortSignal,
): Promise<Response> {
  const res = await d.fetch(url.toString(), {
    method,
    redirect: "manual",
    signal: AbortSignal.any([budget, AbortSignal.timeout(timeoutMs)]),
    headers: { "user-agent": "learn-anything-faster-linkcheck/1" },
  });
  await res.body?.cancel().catch(() => undefined); // never read the body
  return res;
}

/** live: 2xx/3xx. dead: 404/410 or DNS ENOTFOUND on the original host. Everything else is inconclusive. */
export async function checkUrl(raw: string, d: Deps): Promise<Verdict> {
  const timeoutMs = d.limits?.timeoutMs ?? LIMITS.timeoutMs;
  const maxHops = d.limits?.maxHops ?? LIMITS.maxHops;
  const budget = AbortSignal.timeout(d.limits?.urlBudgetMs ?? LIMITS.urlBudgetMs);
  const aborted = new Promise<never>((_, reject) => {
    budget.addEventListener("abort", () => reject(new Error("budget")), { once: true });
  });
  aborted.catch(() => undefined); // avoid an unhandled rejection when nothing races it
  try {
    let current = raw;
    for (let hop = 0; hop <= maxHops; hop++) {
      const g = await Promise.race([guardUrl(current, d.lookup), aborted]);
      if (!g.ok) return hop === 0 && g.reason === "notfound" ? "dead" : "inconclusive";
      let res = await request(g.url, "HEAD", d, timeoutMs, budget);
      if (res.status === 405 || res.status === 501)
        res = await request(g.url, "GET", d, timeoutMs, budget);
      if (REDIRECTS.has(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return "live";
        current = new URL(loc, g.url).toString();
        continue;
      }
      if (res.status === 404 || res.status === 410) return "dead";
      return res.status >= 200 && res.status < 400 ? "live" : "inconclusive";
    }
    return "inconclusive"; // redirect loop / too many hops
  } catch {
    return "inconclusive"; // timeout, TLS, connection errors
  }
}

export async function runLinkCheck(db: LinkDb, d: Deps): Promise<LinkCheckResult> {
  const rowLimit = d.limits?.rows ?? LIMITS.rows;
  const concurrency = d.limits?.concurrency ?? LIMITS.concurrency;
  const deadlineMs = d.limits?.deadlineMs ?? LIMITS.deadlineMs;
  const start = d.now();
  const rows = await db
    .select({ id: resources.id, url: resources.url })
    .from(resources)
    .where(eq(resources.status, "approved"))
    .orderBy(sql`${resources.lastCheckedAt} asc nulls first`)
    .limit(rowLimit);

  const out: LinkCheckResult = {
    checked: 0,
    live: 0,
    dead: 0,
    inconclusive: 0,
    skipped: 0,
    deadIds: [],
    inconclusiveIds: [],
  };
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++]!;
      if (d.now() - start >= deadlineMs) {
        out.skipped++;
        continue;
      }
      const verdict = await checkUrl(row.url, d);
      out.checked++;
      if (verdict === "inconclusive") {
        out.inconclusive++;
        out.inconclusiveIds.push(row.id);
        continue; // no write: retried first next run
      }
      const guard = and(eq(resources.id, row.id), eq(resources.status, "approved"));
      if (verdict === "dead") {
        await db.update(resources).set({ status: "dead", lastCheckedAt: new Date() }).where(guard);
        out.dead++;
        out.deadIds.push(row.id);
      } else {
        await db.update(resources).set({ lastCheckedAt: new Date() }).where(guard);
        out.live++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return out;
}
