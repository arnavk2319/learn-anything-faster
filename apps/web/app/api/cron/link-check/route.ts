import { lookup } from "node:dns/promises";
import { getDb } from "../../../../db/index";
import { handleLinkCheck } from "../../../../lib/linkcheck/http";
import type { LinkDb } from "../../../../lib/linkcheck/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Hobby ceiling

let cached: ReturnType<typeof getDb> | undefined; // one pool per server instance

export function GET(req: Request) {
  return handleLinkCheck(
    req,
    process.env.CRON_SECRET,
    // The neon and node-postgres drizzle clients share the select/update surface used here.
    async () => {
      try {
        return (await (cached ??= getDb())) as unknown as LinkDb;
      } catch (e) {
        cached = undefined; // do not poison the instance after one transient failure
        throw e;
      }
    },
    { fetch, lookup: (h) => lookup(h, { all: true }), now: Date.now },
  );
}
