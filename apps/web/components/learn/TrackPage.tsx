// Server component for the track overview (ADR-0015 sections 4-5): header, Continue, tabs and the active
// panel. Coming-soon tracks render the header and a notice only: no packs, no tabs.
import Link from "next/link";
import type { Track } from "@/lib/learn/schemas";
import type { TrackPack } from "@/lib/learn/content";
import {
  groupByLevel,
  suggestStartConcept,
  trackCountsInWords,
  type ConceptRow,
  type ProblemRow,
} from "@/lib/learn/track-view";
import { LearnShell } from "@/components/shell/LearnShell";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { buildOutline, nextUp } from "@/lib/shell/outline";
import { cn } from "@/lib/utils";
import { MdInline } from "./Md";
import { ContinueCard, RowList, TrackHeaderStatus } from "./TrackProgress";
import { TrackTabs } from "./TrackTabs";

const LEVEL_LABEL = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" } as const;

const link =
  "text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function conceptRows(pack: TrackPack): ConceptRow[] {
  return pack.concepts.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    stage: c.stage,
    hasSim: !("exception" in c.sim),
    order: c.order,
    prerequisites: c.prerequisites,
    quickCheckIds: [...pack.questions.values()]
      .filter((q) => q.conceptId === c.id)
      .map((q) => q.id),
  }));
}

function problemRows(pack: TrackPack): ProblemRow[] {
  return pack.problems.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    difficulty: p.difficulty,
    priority: p.priority,
    hasSim: !("exception" in p.sim),
  }));
}

function Crumbs({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-(length:--text-small) text-muted-foreground">
      <ol className="flex flex-wrap gap-1">
        <li>
          <Link className={link} href="/learn">
            Learn
          </Link>{" "}
          /
        </li>
        <li aria-current="page">{title}</li>
      </ol>
    </nav>
  );
}

const pageCls = "mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-3 p-4 md:p-5";

export function ComingSoonTrack({ track }: { track: Track }) {
  return (
    <LearnShell trackId={track.id} trackTitle={track.title} groups={[]} currentId="" next={[]}>
      <div className={pageCls}>
        <Crumbs title={track.title} />
        <h1 className="font-display font-bold">{track.title}</h1>
        <p className="text-muted-foreground">
          <MdInline text={track.summary} />
        </p>
        <Card className="border-dashed">Coming soon. This track has no content yet.</Card>
      </div>
    </LearnShell>
  );
}

export function TrackPage({ pack, active }: { pack: TrackPack; active: "concepts" | "problems" }) {
  const { track } = pack;
  const concepts = conceptRows(pack);
  const problems = problemRows(pack);
  const base = `/learn/${track.id}`;
  const startId = suggestStartConcept(concepts);
  const start = concepts.find((c) => c.id === startId);
  const groups = buildOutline(track.id, pack.concepts, pack.problems, (id) =>
    [...pack.questions.values()].filter((q) => q.conceptId === id).map((q) => q.id),
  );
  return (
    <LearnShell
      trackId={track.id}
      trackTitle={track.title}
      groups={groups}
      currentId=""
      next={nextUp(groups, "")}
    >
      <div className={pageCls}>
        <Crumbs title={track.title} />
        <div className="flex flex-wrap items-center gap-3">
          <TrackHeaderStatus
            trackId={track.id}
            title={track.title}
            concepts={concepts.map((c) => ({ id: c.id, quickCheckIds: c.quickCheckIds }))}
            problemIds={problems.map((p) => p.id)}
          />
          <div className="min-w-0 flex-1 basis-60 max-sm:order-4 max-sm:basis-full">
            <h1 className="font-display font-bold">{track.title}</h1>
            <p
              data-testid="track-counts"
              className="text-(length:--text-small) text-muted-foreground tabular-nums"
            >
              {trackCountsInWords(concepts.length, problems.length)}
            </p>
          </div>
          {start ? (
            <Link
              href={`${base}/concepts/${start.id}`}
              data-testid="start-with"
              className={cn(buttonVariants({ size: "md" }), "order-2 max-md:h-11")}
            >
              Start with {start.title}
            </Link>
          ) : null}
        </div>
        <p className="text-muted-foreground">
          <MdInline text={track.summary} />
        </p>
        <ContinueCard
          trackId={track.id}
          concepts={concepts.map((c) => ({ id: c.id, title: c.title }))}
          problems={problems.map((p) => ({ id: p.id, title: p.title }))}
        />
        <TrackTabs
          active={active}
          tabs={[
            { id: "concepts", label: "Concepts", count: concepts.length, href: base },
            { id: "problems", label: "Problems", count: problems.length, href: `${base}/problems` },
          ]}
        />
        <div
          role="tabpanel"
          id="track-panel"
          aria-labelledby={`tab-${active}`}
          className="flex min-w-0 flex-col gap-3"
        >
          {active === "concepts" ? (
            concepts.length === 0 ? (
              <p className="text-muted-foreground">No concepts published yet.</p>
            ) : (
              groupByLevel(concepts).map((g) => (
                <section
                  key={g.level}
                  id={g.level}
                  aria-labelledby={`${g.level}-h`}
                  className="flex scroll-mt-4 flex-col gap-1"
                >
                  <h2 id={`${g.level}-h`} className="font-display font-semibold">
                    {LEVEL_LABEL[g.level]}{" "}
                    <span className="text-(length:--text-small) font-normal text-muted-foreground">
                      {g.rows.length} {g.rows.length === 1 ? "concept" : "concepts"}
                    </span>
                  </h2>
                  <RowList trackId={track.id} kind="concept" rows={g.rows} />
                </section>
              ))
            )
          ) : problems.length === 0 ? (
            <p className="text-muted-foreground">No problems published yet.</p>
          ) : (
            <RowList trackId={track.id} kind="problem" rows={problems} />
          )}
        </div>
      </div>
    </LearnShell>
  );
}
