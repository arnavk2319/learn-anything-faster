"use client";
// Progress-dependent bits of the track page (ADR-0015 section 6): ring, Continue, per-row progress and
// favorite toggles. SSR-safe: the first render (server and hydration) uses empty progress, then the
// stored progress is read in an effect, so there is no hydration mismatch.
// Built on the T-078 primitives (Button, Card, Chip, ProgressRing, ProgressBar); rows are 44px high.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  emptyProgress,
  readProgress,
  subscribeProgress,
  toggleFavorite,
  trackProgress,
  writeProgress,
  type FavoriteKind,
  type Progress,
} from "@/lib/learn/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatEstimate } from "@/lib/learn/estimate";
import {
  conceptUnits,
  continueTarget,
  percent,
  type ConceptRow,
  type ProblemRow,
} from "@/lib/learn/track-view";

export function useLearnProgress(): {
  progress: Progress;
  toggle: (k: FavoriteKind, id: string) => void;
} {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  useEffect(() => {
    setProgress(readProgress());
    return subscribeProgress(setProgress);
  }, []);
  const toggle = useCallback((kind: FavoriteKind, id: string) => {
    // Read fresh so a stale instance never overwrites another instance's write.
    const next = toggleFavorite(readProgress(), kind, id);
    writeProgress(next);
    setProgress(next);
  }, []);
  return { progress, toggle };
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Star({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "size-11! rounded-pill p-0 text-xl",
        pressed ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span aria-hidden="true">{pressed ? "★" : "☆"}</span>
    </Button>
  );
}

export function TrackHeaderStatus({
  trackId,
  title,
  concepts,
  problemIds,
}: {
  trackId: string;
  title: string;
  concepts: { id: string; quickCheckIds: string[] }[];
  problemIds: string[];
}) {
  const { progress, toggle } = useLearnProgress();
  const pct = percent(trackProgress(progress, { concepts, problemIds }));
  return (
    <>
      <ProgressRing
        value={pct}
        size="md"
        label={`${pct}% of ${title} done`}
        data-testid="track-ring"
      />
      <span className="order-3">
        <Star
          pressed={progress.favorites.tracks.includes(trackId)}
          label={`Favorite ${title}`}
          onClick={() => toggle("tracks", trackId)}
        />
      </span>
    </>
  );
}

export function ContinueCard({
  trackId,
  concepts,
  problems,
}: {
  trackId: string;
  concepts: { id: string; title: string }[];
  problems: { id: string; title: string }[];
}) {
  const { progress } = useLearnProgress();
  const target = continueTarget(progress.last, trackId, concepts, problems);
  if (!target) return null;
  return (
    <Card data-testid="continue" className="flex flex-wrap items-center gap-3 py-2">
      <div className="min-w-60 flex-1">
        <p className="text-(length:--text-small) text-muted-foreground">
          Continue where you left off
        </p>
        <p>
          <b>{target.title}</b>{" "}
          <span className="text-(length:--text-small) text-muted-foreground">{target.kind}</span>
        </p>
      </div>
      <Link href={target.href} className={cn(buttonVariants({ size: "md" }), "max-md:h-11")}>
        Continue
      </Link>
    </Card>
  );
}

const STAGE_LABEL = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" } as const;

/**
 * Concept cards (T-099, ADR-0016 amendment 1, prototype variant A). The card is one link (a stretched
 * pseudo-element on the title link); the star is a separate 44px button above it, so clicking it never navigates.
 * Hover lift and press act on the inner element; the global reduced-motion rule zeroes the transitions.
 */
export function ConceptCards({ trackId, rows }: { trackId: string; rows: ConceptRow[] }) {
  const { progress, toggle } = useLearnProgress();
  return (
    <ul className="flex min-w-0 flex-col gap-3">
      {rows.map((r) => {
        const u = conceptUnits(progress, r);
        const label = u.complete ? "Done" : `${u.done} of ${u.total} done`;
        return (
          <li key={r.id} data-testid="concept-card" className="group/card relative min-w-0">
            <div className="relative grid min-h-22 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg border border-border-firm bg-card py-3 pr-2 pb-4 pl-4 text-card-foreground shadow-[var(--shadow-rest)] transition-[translate,box-shadow,scale] duration-(--dur-lift) ease-(--ease-out) group-hover/card:translate-y-(--lift-y) group-hover/card:shadow-[var(--shadow-lift)] group-active/card:scale-(--press-scale) group-active/card:shadow-[var(--shadow-press)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">
                  <Link
                    href={`/learn/${trackId}/concepts/${r.id}`}
                    className="text-foreground outline-none after:absolute after:inset-0 after:z-1 after:content-['']"
                  >
                    {r.title}
                  </Link>
                </h3>
                <p
                  data-testid="concept-summary"
                  className="truncate text-(length:--text-small) text-muted-foreground"
                >
                  {r.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {r.estMin !== undefined ? <Chip>{formatEstimate(r.estMin)}</Chip> : null}
                  <Chip>{STAGE_LABEL[r.stage]}</Chip>
                  {r.hasSim ? (
                    <Chip className="border-route bg-transparent text-route">Sim</Chip>
                  ) : null}
                  {u.complete ? <Chip className="border-route text-route">Done</Chip> : null}
                </div>
              </div>
              <div className="relative z-2">
                <Star
                  pressed={progress.favorites.concepts.includes(r.id)}
                  label={`Favorite ${r.title}`}
                  onClick={() => toggle("concepts", r.id)}
                />
              </div>
              <ProgressBar
                value={percent(u.ratio)}
                label={`${r.title}: ${label}`}
                className="absolute inset-x-0 bottom-0 h-1 w-full rounded-none"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RowList({
  trackId,
  kind,
  rows,
}: {
  trackId: string;
  kind: "concept" | "problem";
  rows: (ConceptRow | ProblemRow)[];
}) {
  const { progress, toggle } = useLearnProgress();
  const fav: FavoriteKind = kind === "concept" ? "concepts" : "problems";
  return (
    <Card className="overflow-hidden p-0">
      <ul className="flex min-w-0 flex-col divide-y divide-border">
        {rows.map((r) => {
          let ratio: number;
          let label: string;
          let count: string;
          let complete: boolean;
          if (kind === "concept") {
            const u = conceptUnits(progress, r as ConceptRow);
            ratio = u.ratio;
            count = `${u.done}/${u.total}`;
            complete = u.complete;
            label = complete ? "Done" : `${u.done} of ${u.total} done`;
          } else {
            complete = progress.items[r.id]?.seenAt !== undefined;
            ratio = complete ? 1 : 0;
            count = complete ? "Seen" : "New";
            label = complete ? "Seen" : "Not started";
          }
          const href = `/learn/${trackId}/${kind === "concept" ? "concepts" : "problems"}/${r.id}`;
          return (
            <li key={r.id} className="flex h-11 items-center gap-2 pr-1 pl-3">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-pill ${complete ? "bg-route" : "bg-border"}`}
              />
              <Link
                href={href}
                className={`inline-flex min-h-11 max-w-[60%] shrink-0 items-center font-medium text-primary underline-offset-2 hover:underline ${focusRing}`}
              >
                <span className="truncate">{r.title}</span>
              </Link>
              <p className="hidden min-w-0 flex-1 truncate text-(length:--text-small) text-muted-foreground md:block">
                {r.summary}
              </p>
              <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
                {kind === "problem" ? (
                  <Chip className="hidden md:inline-flex">{(r as ProblemRow).difficulty}</Chip>
                ) : null}
                {r.hasSim ? (
                  <Chip className="border-route bg-transparent text-route">sim</Chip>
                ) : null}
                <ProgressBar
                  value={percent(ratio)}
                  label={`${r.title}: ${label}`}
                  className="w-12 md:w-20"
                />
                <span className="hidden w-9 text-(length:--text-small) text-muted-foreground tabular-nums md:inline">
                  {count}
                </span>
                <Star
                  pressed={progress.favorites[fav].includes(r.id)}
                  label={`Favorite ${r.title}`}
                  onClick={() => toggle(fav, r.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
