"use client";
// Progress-dependent bits of the track page (ADR-0015 section 6): ring, Continue, per-row progress and
// favorite toggles. SSR-safe: the first render (server and hydration) uses empty progress, then the
// stored progress is read in an effect, so there is no hydration mismatch.
import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`inline-grid size-11 shrink-0 place-items-center rounded-pill text-xl hover:bg-lane ${pressed ? "text-primary" : "text-muted-foreground"} ${focusRing}`}
    >
      <span aria-hidden="true">{pressed ? "★" : "☆"}</span>
    </button>
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
      <span
        role="img"
        aria-label={`${pct}% of ${title} done`}
        data-testid="track-ring"
        style={{ "--p": pct } as CSSProperties}
        className="relative grid size-[var(--ring-lg)] shrink-0 place-items-center rounded-pill bg-[conic-gradient(var(--route)_calc(var(--p)*1%),var(--border)_0)] before:absolute before:inset-[var(--ring-thickness)] before:rounded-pill before:bg-card before:content-['']"
      >
        <b className="relative text-base font-semibold tabular-nums">{pct}%</b>
      </span>
      <span className="ml-auto">
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
    <div
      data-testid="continue"
      className="rounded-panel flex flex-wrap items-center gap-4 border bg-card px-5 py-4"
    >
      <div className="min-w-60 flex-1">
        <p className="text-sm text-muted-foreground">Continue where you left off</p>
        <p>
          <b>{target.title}</b> <span className="text-sm text-muted-foreground">{target.kind}</span>
        </p>
      </div>
      <Link
        href={target.href}
        className={`rounded-control inline-flex h-11 items-center bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover ${focusRing}`}
      >
        Continue
      </Link>
    </div>
  );
}

const simBadge =
  "inline-flex h-6 items-center rounded-pill border border-route px-2.5 text-xs font-semibold text-route";

function Bar({ ratio, label }: { ratio: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      style={{ "--p": percent(ratio) } as CSSProperties}
      className="block h-1.5 w-14 shrink-0 overflow-hidden rounded-pill bg-border sm:w-24"
    >
      <i className="block h-full w-[calc(var(--p)*1%)] bg-route" />
    </span>
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
    <ul className="flex min-w-0 flex-col gap-2">
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
          <li
            key={r.id}
            className="rounded-panel flex items-center gap-3 border bg-card py-2 pr-1 pl-4"
          >
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-pill ${complete ? "bg-route" : "bg-border"}`}
            />
            <div className="min-w-0 flex-1">
              <Link
                href={href}
                className={`font-medium text-primary underline-offset-2 hover:underline ${focusRing}`}
              >
                {r.title}
              </Link>
              <p className="truncate text-sm text-muted-foreground">{r.summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {kind === "problem" ? (
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {(r as ProblemRow).difficulty}
                </span>
              ) : null}
              {r.hasSim ? <span className={simBadge}>sim</span> : null}
              <Bar ratio={ratio} label={`${r.title}: ${label}`} />
              <span className="hidden w-10 text-sm text-muted-foreground tabular-nums sm:inline">
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
  );
}
