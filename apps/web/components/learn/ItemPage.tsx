// Server component shared by the concept and problem pages: header, level anchors, blocks, cross-links, JSON-LD.
import Link from "next/link";
import type { Concept, Problem } from "@/lib/learn/schemas";
import { questionsFor, resolveBlockSim, resolveItemSim, type TrackPack } from "@/lib/learn/content";
import { getSiteUrl } from "@/lib/site";
import { Blocks, type BlockContext } from "./Blocks";
import { LearnTracker } from "./LearnTracker";
import { OnThisPage } from "./OnThisPage";
import { SimFrame } from "./SimFrame";
import { FeedbackButton, FeedbackScope } from "./Feedback";
import { Chip } from "@/components/ui/chip";
import { MdInline } from "./Md";
import { LearnShell } from "@/components/shell/LearnShell";
import { buildOutline, nextUp } from "@/lib/shell/outline";

const LEVELS = ["basic", "intermediate", "advanced"] as const;
const LEVEL_LABEL = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" } as const;

const link =
  "text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function contextFor(item: Concept | Problem, pack: TrackPack, sideSimId?: string): BlockContext {
  return {
    sideSimId,
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
  const levels = "levels" in item ? LEVELS.filter((l) => (item.levels[l]?.length ?? 0) > 0) : [];
  const allBlocks = "levels" in item ? Object.values(item.levels).flat() : item.blocks;
  // The sticky side pane shows the item's own sim, else the first sim block's target. Sim blocks that point at it
  // render nothing in the text column; other sims stay inline. No sim: the text column uses the full width.
  const firstSimBlock = allBlocks.find((blk) => blk.type === "sim");
  const sideSim =
    resolveItemSim(item, pack) ??
    (firstSimBlock?.type === "sim" ? resolveBlockSim(firstSimBlock.ref, item, pack) : null);
  const ctx = contextFor(item, pack, sideSim?.id);

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

  const groups = buildOutline(trackId, pack.concepts, pack.problems, (id) =>
    [...pack.questions.values()].filter((q) => q.conceptId === id).map((q) => q.id),
  );

  const nextItem = nextUp(groups, item.id).find((i) => i.kind === "concept");
  const conceptCtx = {
    id: item.id,
    title: item.title,
    quickCheckIds:
      groups.flatMap((g) => g.items).find((i) => i.id === item.id)?.quickCheckIds ?? [],
    ...(nextItem ? { next: { href: nextItem.href, title: nextItem.title } } : {}),
  };

  return (
    <LearnShell
      trackId={trackId}
      trackTitle={pack.track.title}
      groups={groups}
      currentId={item.id}
      next={nextUp(groups, item.id)}
    >
      <FeedbackScope trackId={trackId} itemId={item.id}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
          <LearnTracker
            trackId={trackId}
            trackTitle={pack.track.title}
            kind={kind}
            id={item.id}
            {...(kind === "concept" ? { concept: conceptCtx } : {})}
          />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
          <OnThisPage />
          <header className="flex flex-col gap-2">
            <nav
              aria-label="Breadcrumb"
              className="text-(length:--text-small) text-muted-foreground"
            >
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
            {/* Eyebrow chips. Header keeps its right side free for the T-085 feedback icon. */}
            <div className="flex flex-wrap items-center gap-1.5" data-testid="item-eyebrow">
              <Chip>{kind === "concept" ? "Concept" : "Problem"}</Chip>
              <Chip>{"stage" in item ? item.stage : item.difficulty}</Chip>
            </div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display font-bold">{item.title}</h1>
              <FeedbackButton kind={kind} targetId={item.id} label={kind} />
            </div>
            <p className="max-w-[75ch] text-muted-foreground">
              <MdInline text={item.summary} />
            </p>
            {levels.length > 1 ? (
              <nav aria-label="Levels" className="flex gap-1.5">
                {levels.map((l) => (
                  <a
                    key={l}
                    href={`#${l}`}
                    className="rounded-pill border border-border-firm bg-card px-2.5 py-0.5 text-(length:--text-small) hover:bg-lane focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {LEVEL_LABEL[l]}
                  </a>
                ))}
              </nav>
            ) : null}
          </header>

          <div
            data-testid="item-body"
            className={
              sideSim
                ? "flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-6"
                : "flex flex-col gap-4"
            }
          >
            <div
              data-testid="item-text"
              className={`flex min-w-0 flex-col gap-4 ${sideSim ? "" : "max-w-[75ch]"}`}
            >
              {"levels" in item ? (
                levels.map((l) => (
                  <section
                    key={l}
                    id={l}
                    aria-labelledby={`${l}-h`}
                    className="flex scroll-mt-4 flex-col gap-3"
                  >
                    <h2 id={`${l}-h`} className="font-display font-semibold">
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
                      <h2 className="font-display font-semibold">
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
                      <h2 className="font-display font-semibold">Practice problems</h2>
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
            </div>
            {sideSim ? (
              <div
                data-testid="item-sim"
                className="min-w-0 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-var(--header-h)-1.5rem)] lg:overflow-y-auto"
              >
                <SimFrame sim={sideSim} title={sideSim.id} />
              </div>
            ) : null}
          </div>
        </div>
      </FeedbackScope>
    </LearnShell>
  );
}
