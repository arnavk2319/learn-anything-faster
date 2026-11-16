// Pure view logic for the /learn landing (ADR-0015 sections 4-6). No React, no storage access.
import { trackProgress, type Progress } from "./progress";

export const FILTERS = ["all", "live", "soon", "favorites", "progress"] as const;
export type Filter = (typeof FILTERS)[number];

export interface LandingTrack {
  id: string;
  title: string;
  summary: string;
  status: "live" | "soon";
  counts: { concepts: number; problems: number; questions: number };
  /** True when some of the content is our own authoring rather than sourced (src kind "gap"). */
  addedByUs: boolean;
  concepts: { id: string; quickCheckIds: string[] }[];
  problemIds: string[];
}

/** Anything not in the list falls back to All. */
export function parseFilter(v: string | null | undefined): Filter {
  return (FILTERS as readonly string[]).includes(v ?? "") ? (v as Filter) : "all";
}

export function trackRatio(p: Progress, t: LandingTrack): number {
  return t.status === "live"
    ? trackProgress(p, { concepts: t.concepts, problemIds: t.problemIds })
    : 0;
}

/** Started = any concept or problem seen, or any quick check answered. */
export function isStarted(p: Progress, t: LandingTrack): boolean {
  if (t.status !== "live") return false;
  return (
    t.problemIds.some((id) => p.items[id]?.seenAt !== undefined) ||
    t.concepts.some(
      (c) =>
        p.items[c.id]?.seenAt !== undefined ||
        c.quickCheckIds.some((q) => p.answers[q] !== undefined),
    )
  );
}

export function filterTracks(
  tracks: LandingTrack[],
  filter: Filter,
  p: Progress,
  query = "",
): LandingTrack[] {
  const q = query.trim().toLowerCase();
  return tracks.filter((t) => {
    if (q && !`${t.title} ${t.summary}`.toLowerCase().includes(q)) return false;
    switch (filter) {
      case "live":
        return t.status === "live";
      case "soon":
        return t.status === "soon";
      case "favorites":
        return p.favorites.tracks.includes(t.id);
      case "progress": {
        return isStarted(p, t) && trackRatio(p, t) < 1;
      }
      default:
        return true;
    }
  });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 concepts, 8 problems, 40 questions": counts always in words, never a bare number. */
export function countsInWords(c: LandingTrack["counts"]): string {
  return [
    plural(c.concepts, "concept", "concepts"),
    plural(c.problems, "problem", "problems"),
    plural(c.questions, "question", "questions"),
  ].join(", ");
}
