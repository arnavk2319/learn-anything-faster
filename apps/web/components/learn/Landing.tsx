"use client";
// /learn landing (ADR-0015 section 5, DESIGN.md 14.2). Server renders the track list with empty progress; this
// island adds filters, view toggle, lazy search and progress. Query and filter live in the URL (`?q=&filter=`),
// read after mount so the page itself stays static. Progress never leaves the device.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  countsInWords,
  filterTracks,
  FILTERS,
  parseFilter,
  trackRatio,
  type Filter,
  type LandingTrack,
} from "@/lib/learn/landing-view";
import { emptyProgress, writeProgress } from "@/lib/learn/progress";
import { searchDocs, type SearchDoc } from "@/lib/learn/search";
import { percent } from "@/lib/learn/track-view";
import { Star, useLearnProgress } from "./TrackProgress";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  live: "Live",
  soon: "Soon",
  favorites: "Favorites",
  progress: "In progress",
};
const TYPE_LABEL: Record<SearchDoc["type"], string> = {
  track: "Track",
  concept: "Concept",
  problem: "Problem",
  question: "Question",
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const countWord = (k: "concepts" | "problems" | "questions", n: number) =>
  `${n} ${n === 1 ? k.slice(0, -1) : k}`;
const touch = "min-h-11 min-w-11";

type View = "auto" | "bubbles" | "list";

function readUrl(): { q: string; filter: Filter } {
  const sp = new URLSearchParams(window.location.search);
  return { q: (sp.get("q") ?? "").slice(0, 100), filter: parseFilter(sp.get("filter")) };
}

function writeUrl(q: string, filter: Filter, mode: "push" | "replace") {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (filter !== "all") sp.set("filter", filter);
  const qs = sp.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (mode === "push") window.history.pushState(window.history.state, "", url);
  else window.history.replaceState(window.history.state, "", url);
}

function Ring({ pct, label, size }: { pct: number; label: string; size: "sm" | "md" }) {
  return (
    <span
      role="img"
      aria-label={label}
      style={{ "--p": pct } as CSSProperties}
      className={`relative grid shrink-0 place-items-center rounded-pill bg-[conic-gradient(var(--route)_calc(var(--p)*1%),var(--border)_0)] before:absolute before:inset-[calc(var(--ring-thickness)*0.6)] before:rounded-pill before:bg-card before:content-[''] ${size === "md" ? "size-[var(--ring-md)]" : "size-[var(--ring-sm)]"}`}
    >
      {size === "md" ? <b className="relative text-xs font-semibold tabular-nums">{pct}%</b> : null}
    </span>
  );
}

function AddedByUs() {
  return (
    <span className="inline-flex h-6 items-center rounded-pill border border-border bg-lane px-2.5 text-xs font-medium text-foreground">
      Added by us
    </span>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex h-6 items-center rounded-pill border border-dashed border-muted-foreground px-2.5 text-xs font-medium text-foreground">
      Coming soon
    </span>
  );
}

export function Landing({ tracks }: { tracks: LandingTrack[] }) {
  const { progress, toggle } = useLearnProgress();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("auto");
  const [index, setIndex] = useState<SearchDoc[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const loading = useRef(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const loadIndex = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    fetch("/learn/search-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error("bad shape");
        setIndex(
          data.filter(
            (d): d is SearchDoc =>
              typeof d === "object" &&
              d !== null &&
              typeof (d as SearchDoc).title === "string" &&
              typeof (d as SearchDoc).url === "string",
          ),
        );
      })
      .catch(() => {
        setIndexError(true);
        loading.current = false;
      });
  }, []);

  // URL state: read after mount and on back/forward.
  useEffect(() => {
    const sync = () => {
      const u = readUrl();
      setQ(u.q);
      setFilter(u.filter);
      if (u.q) loadIndex();
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [loadIndex]);

  const pickFilter = (f: Filter) => {
    setFilter(f);
    writeUrl(q, f, "push");
  };
  const onQuery = (value: string) => {
    setQ(value);
    writeUrl(value, filter, "replace");
  };

  const shown = filterTracks(tracks, filter, progress, q);
  const results = index && q.trim() ? searchDocs(index, q) : [];
  const bubblesCls = view === "bubbles" ? "grid" : view === "list" ? "hidden" : "hidden md:grid";
  const listCls = view === "bubbles" ? "hidden" : view === "list" ? "block" : "block md:hidden";

  const reset = () => {
    writeProgress(emptyProgress()); // device only: no request is made
    setConfirmReset(false);
    setResetDone(true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label className="sr-only" htmlFor="learn-q">
            Search tracks, concepts, problems and questions
          </label>
          <input
            id="learn-q"
            type="search"
            value={q}
            placeholder="Search concepts, problems, questions"
            onFocus={loadIndex}
            onChange={(e) => onQuery(e.target.value)}
            className={`rounded-control h-11 w-full border border-input bg-card px-4 text-base placeholder:text-muted-foreground ${focusRing}`}
          />
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          {(["bubbles", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-control h-11 px-4 text-sm font-medium ${touch} ${view === v ? "bg-highlight text-highlight-foreground" : "border border-border bg-card hover:bg-lane"} ${focusRing}`}
            >
              {v === "bubbles" ? "Bubbles" : "List"}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Filter tracks" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => pickFilter(f)}
            className={`h-11 rounded-pill px-4 text-sm font-medium ${touch} ${filter === f ? "bg-highlight text-highlight-foreground" : "border border-border bg-card hover:bg-lane"} ${focusRing}`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {q.trim() ? (
        <section aria-label="Search results" className="rounded-panel border bg-card px-5 py-4">
          {indexError ? (
            <p className="text-muted-foreground">Search is unavailable right now. Try again.</p>
          ) : index === null ? (
            <p className="text-muted-foreground" role="status">
              Loading search
            </p>
          ) : results.length === 0 ? (
            <p role="status">
              <b>No matches for &ldquo;{q.trim()}&rdquo;.</b>{" "}
              <span className="text-muted-foreground">Try a shorter word.</span>
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground" role="status">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
              <ul className="flex flex-col">
                {results.map((r) => (
                  <li key={`${r.type}-${r.id}`} className="border-b border-border last:border-0">
                    <Link
                      href={r.url}
                      className={`flex min-h-11 flex-wrap items-center gap-x-3 py-2 ${focusRing}`}
                    >
                      <span className="font-medium text-primary underline-offset-2 hover:underline">
                        {r.title}
                      </span>
                      <span className="text-sm text-muted-foreground">{TYPE_LABEL[r.type]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {shown.length === 0 ? (
        <div className="rounded-panel border bg-card px-5 py-4">
          <h2 className="font-display text-lg font-semibold">No tracks match</h2>
          <p className="text-muted-foreground">Clear the search or pick another filter.</p>
        </div>
      ) : null}

      <ol
        aria-label="Tracks"
        className={`bubbles m-0 list-none grid-cols-[repeat(auto-fill,minmax(var(--bubble-size-sm),1fr))] justify-items-center gap-5 p-0 py-6 md:grid-cols-[repeat(auto-fill,minmax(var(--bubble-size),1fr))] md:gap-8 ${bubblesCls}`}
      >
        {shown.map((t) => {
          const pct = percent(trackRatio(progress, t));
          const live = t.status === "live";
          const bubble = `bubble-float relative flex size-[var(--bubble-size-sm)] flex-col items-center justify-center gap-1 rounded-pill p-4 text-center text-foreground no-underline md:size-[var(--bubble-size)] md:p-6 ${live ? "border-[1.5px] border-route bg-known hover:border-primary" : "border-[1.5px] border-dashed border-muted-foreground bg-lane-band"}`;
          return (
            <li key={t.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                {live ? (
                  <Link href={`/learn/${t.id}`} className={`${bubble} ${focusRing}`}>
                    <h3 className="font-display text-base leading-tight font-semibold md:text-lg">
                      {t.title}
                    </h3>
                    <span className="text-xs text-balance text-muted-foreground tabular-nums">
                      {countsInWords(t.counts)}
                    </span>
                    <Ring pct={pct} label={`${pct}% of ${t.title} done`} size="md" />
                  </Link>
                ) : (
                  <div role="group" aria-label={`${t.title}, coming soon`} className={bubble}>
                    <h3 className="font-display text-base leading-tight font-semibold md:text-lg">
                      {t.title}
                    </h3>
                    <ComingSoonBadge />
                  </div>
                )}
                <span className="absolute top-1 right-1 z-10 rounded-pill border border-border bg-card">
                  <Star
                    pressed={progress.favorites.tracks.includes(t.id)}
                    label={`Favorite ${t.title}`}
                    onClick={() => toggle("tracks", t.id)}
                  />
                </span>
              </div>
              {t.addedByUs ? <AddedByUs /> : null}
            </li>
          );
        })}
      </ol>

      <div className={listCls}>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Tracks</caption>
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              <th scope="col" className="px-2 py-2 font-medium">
                Track
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-2 py-2 font-medium max-md:hidden">
                Concepts
              </th>
              <th scope="col" className="px-2 py-2 font-medium max-md:hidden">
                Problems
              </th>
              <th scope="col" className="px-2 py-2 font-medium max-md:hidden">
                Questions
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Progress
              </th>
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Favorite</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const pct = percent(trackRatio(progress, t));
              const live = t.status === "live";
              return (
                <tr
                  key={t.id}
                  className={`border-b border-border ${live ? "border-l-4 border-l-route" : ""}`}
                >
                  <td className="px-2 py-1 align-middle">
                    {live ? (
                      <Link
                        href={`/learn/${t.id}`}
                        className={`inline-flex min-h-11 items-center font-medium text-primary underline-offset-2 hover:underline ${focusRing}`}
                      >
                        {t.title}
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center font-medium">
                        {t.title}
                      </span>
                    )}
                    {live ? (
                      <span className="block text-sm text-muted-foreground tabular-nums md:hidden">
                        {countsInWords(t.counts)}
                      </span>
                    ) : null}
                    {t.addedByUs ? (
                      <span className="mt-1 block">
                        <AddedByUs />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 align-middle">
                    {live ? (
                      <span className="inline-flex h-6 items-center rounded-pill border border-route px-2.5 text-xs font-medium">
                        Live
                      </span>
                    ) : (
                      <ComingSoonBadge />
                    )}
                  </td>
                  {(["concepts", "problems", "questions"] as const).map((k) => (
                    <td
                      key={k}
                      className="px-2 py-1 align-middle text-sm text-muted-foreground tabular-nums max-md:hidden"
                    >
                      {live ? countWord(k, t.counts[k]) : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1 align-middle">
                    {live ? (
                      <span className="inline-flex items-center gap-2">
                        <Ring pct={pct} label={`${pct}% of ${t.title} done`} size="sm" />
                        <span className="text-sm tabular-nums">{pct}% done</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground" aria-hidden="true">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 align-middle">
                    <Star
                      pressed={progress.favorites.tracks.includes(t.id)}
                      label={`Favorite ${t.title}`}
                      onClick={() => toggle("tracks", t.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-border pt-5">
        {confirmReset ? (
          <div role="group" aria-label="Confirm reset" className="flex flex-col gap-3">
            <p>
              This clears your answers, favorites and progress. They are stored only on this device,
              so it cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className={`rounded-control h-11 bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover ${focusRing}`}
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={`rounded-control h-11 border border-border bg-card px-5 font-medium hover:bg-lane ${focusRing}`}
              >
                Keep my progress
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setResetDone(false);
              setConfirmReset(true);
            }}
            className={`rounded-control h-11 border border-border bg-card px-5 font-medium hover:bg-lane ${focusRing}`}
          >
            Reset my progress
          </button>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {resetDone ? "Your progress was cleared on this device." : ""}
        </p>
      </div>
    </div>
  );
}
