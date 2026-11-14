// Server component shared by the concept and problem pages: header, level anchors, blocks, cross-links, JSON-LD.
import Link from "next/link";
import type { Concept, Problem } from "@/lib/learn/schemas";
import { questionsFor, resolveBlockSim, resolveItemSim, type TrackPack } from "@/lib/learn/content";
import { getSiteUrl } from "@/lib/site";
import { Blocks, type BlockContext } from "./Blocks";
import { LearnTracker } from "./LearnTracker";
import { MdInline } from "./Md";

const LEVELS = ["basic", "intermediate", "advanced"] as const;
const LEVEL_LABEL = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" } as const;

const link =
  "text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function contextFor(item: Concept | Problem, pack: TrackPack): BlockContext {
  return {
    sim: (ref) => resolveBlockSim(ref, item, pack),
    questions: (ids) => questionsFor(pack, ids),
    gradingUrl: `/learn/${pack.track.id}/quiz/${item.id}`,
  };
}

export function ItemPage({
  pack,
  kind,
  item,
}: {
  pack: TrackPack;
  kind: "concept" | "problem";
  item: Concept | Problem;
}) {
  const trackId = pack.track.id;
  const ctx = contextFor(item, pack);
  const levels = "levels" in item ? LEVELS.filter((l) => (item.levels[l]?.length ?? 0) > 0) : [];
  const allBlocks = "levels" in item ? Object.values(item.levels).flat() : item.blocks;
  const ownSim = resolveItemSim(item, pack);
  // The item's own sim is shown at the top unless a sim block already places it in the body.
  const topSim =
    ownSim && !allBlocks.some((b) => b.type === "sim" && b.ref === ownSim.id) ? ownSim : null;

  const conceptLinks =
    "prerequisites" in item
      ? item.prerequisites.flatMap((id) => pack.concepts.filter((c) => c.id === id))
      : item.conceptIds.flatMap((id) => pack.concepts.filter((c) => c.id === id));
  const problemLinks =
    kind === "concept" ? pack.problems.filter((p) => p.conceptIds.includes(item.id)) : [];

  const url = `${getSiteUrl()}/learn/${trackId}/${kind === "concept" ? "concepts" : "problems"}/${item.id}`;
  const crumbs = [
    { name: "Learn", url: `${getSiteUrl()}/learn` },
    { name: pack.track.title, url: `${getSiteUrl()}/learn/${trackId}` },
    { name: item.title, url },
  ];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: item.title,
      description: item.summary,
      mainEntityOfPage: url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.url,
      })),
    },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6 sm:p-8">
      <LearnTracker trackId={trackId} kind={kind} id={item.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link className={link} href="/learn">
                Learn
              </Link>{" "}
              /
            </li>
            <li>
              <Link className={link} href={`/learn/${trackId}`}>
                {pack.track.title}
              </Link>{" "}
              /
            </li>
            <li aria-current="page">{item.title}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{item.title}</h1>
          <span className="rounded-pill border px-2 py-0.5 text-sm">
            {"stage" in item ? item.stage : item.difficulty}
          </span>
        </div>
        <p className="text-muted-foreground">
          <MdInline text={item.summary} />
        </p>
        {levels.length > 1 ? (
          <nav aria-label="Levels" className="flex gap-2">
            {levels.map((l) => (
              <a
                key={l}
                href={`#${l}`}
                className="rounded-pill border bg-card px-3 py-1 text-sm hover:bg-lane focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {LEVEL_LABEL[l]}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {topSim ? (
        <Blocks
          blocks={[
            {
              id: "own-sim",
              type: "sim",
              ref: topSim.id,
              src: { kind: "gap", note: "the item's own simulation" },
            },
          ]}
          ctx={ctx}
        />
      ) : null}

      {"levels" in item ? (
        levels.map((l) => (
          <section
            key={l}
            id={l}
            aria-labelledby={`${l}-h`}
            className="flex scroll-mt-20 flex-col gap-4"
          >
            <h2 id={`${l}-h`} className="font-display text-2xl font-semibold">
              {LEVEL_LABEL[l]}
            </h2>
            <Blocks blocks={item.levels[l] ?? []} ctx={ctx} />
          </section>
        ))
      ) : (
        <Blocks blocks={item.blocks} ctx={ctx} />
      )}

      {conceptLinks.length > 0 || problemLinks.length > 0 ? (
        <nav aria-label="Related" className="flex flex-col gap-3 border-t pt-6">
          {conceptLinks.length > 0 ? (
            <div>
              <h2 className="font-display text-lg font-semibold">
                {kind === "concept" ? "Prerequisites" : "Concepts to know"}
              </h2>
              <ul className="mt-1 flex flex-col gap-1">
                {conceptLinks.map((c) => (
                  <li key={c.id}>
                    <Link className={link} href={`/learn/${trackId}/concepts/${c.id}`}>
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {problemLinks.length > 0 ? (
            <div>
              <h2 className="font-display text-lg font-semibold">Practice problems</h2>
              <ul className="mt-1 flex flex-col gap-1">
                {problemLinks.map((p) => (
                  <li key={p.id}>
                    <Link className={link} href={`/learn/${trackId}/problems/${p.id}`}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
