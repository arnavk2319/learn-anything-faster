import type { MetadataRoute } from "next";
import { getCatalog } from "../lib/roadmap/catalog";
import { sharedDb } from "../lib/roadmap/db";
import { getSiteUrl } from "../lib/site";

export const dynamic = "force-dynamic"; // live roadmaps come from the DB

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const urls = [`${site}/`, `${site}/roadmaps`];
  try {
    for (const e of await getCatalog(await sharedDb())) {
      if (e.status === "live") {
        urls.push(`${site}/roadmap/${encodeURIComponent(e.from)}/${encodeURIComponent(e.to)}`);
      }
    }
  } catch {
    // DB unavailable: still serve the static routes rather than failing the crawl.
  }
  return urls.map((url) => ({ url }));
}
