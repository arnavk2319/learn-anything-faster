import { createHash, timingSafeEqual } from "node:crypto";
import { runLinkCheck, type Deps, type LinkDb } from "./service";

const NO_STORE = { "cache-control": "no-store" };

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Fails closed: unset or empty secret, or any mismatch, gets the same 401. */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function handleLinkCheck(
  req: Request,
  secret: string | undefined,
  getDb: () => Promise<LinkDb>,
  deps: Deps,
): Promise<Response> {
  if (!isAuthorized(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const result = await runLinkCheck(await getDb(), deps);
  if (result.dead > 0) {
    // Ids only: no URLs, titles or errors. Read from Vercel runtime logs (docs/ops/link-check.md).
    console.warn(
      JSON.stringify({
        evt: "link-check",
        checked: result.checked,
        dead: result.dead,
        inconclusive: result.inconclusive,
        deadIds: result.deadIds,
      }),
    );
  }
  return Response.json(result, { headers: NO_STORE });
}
