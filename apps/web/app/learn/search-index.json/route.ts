// Search index for /learn (ADR-0015 section 4): live tracks plus approved concepts, problems and
// question prompts, built from the same loader the pages use. Static: built once, cached by the CDN.
// The client fetches it lazily on first focus of the search box, never on page load.
import { NextResponse } from "next/server";
import { contentRoot, isSafeId, loadTrack } from "@/lib/learn/content";
import { buildSearchIndex } from "../../../../../scripts/lib/learn/indexes.ts";
import type { SearchDoc } from "@/lib/learn/search";
import { existsSync, readdirSync } from "node:fs";

export const dynamic = "force-static";

export function GET() {
  const root = contentRoot();
  const dirs = existsSync(root)
    ? readdirSync(root).filter((d) => !d.startsWith("_") && isSafeId(d))
    : [];
  const docs: SearchDoc[] = [];
  for (const dir of dirs) {
    const pack = loadTrack(dir);
    if (!pack || pack.concepts.length + pack.problems.length === 0) continue;
    docs.push({
      id: pack.track.id,
      type: "track",
      title: pack.track.title,
      summary: pack.track.summary,
      tags: [pack.track.category],
      url: `/learn/${pack.track.id}`,
    });
    docs.push(
      ...buildSearchIndex(
        {
          concepts: pack.concepts,
          problems: pack.problems,
          questions: [...pack.questions.values()],
        },
        pack.track.id,
      ),
    );
  }
  return NextResponse.json(docs, { headers: { "cache-control": "public, max-age=300" } });
}
