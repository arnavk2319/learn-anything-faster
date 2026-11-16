// Server-only data for the /learn landing (ADR-0015 section 5). Live tracks come from approved content
// on disk; coming-soon tracks come from the constant list below unless a track.yaml says otherwise.
import { existsSync, readdirSync } from "node:fs";
import { contentRoot, isSafeId, loadTrack, loadTrackMeta, titleFromId } from "./content";
import type { LandingTrack } from "./landing-view";

/** The four planned tracks shown as coming soon (design/wireframes/learn/learn-landing.html). */
export const COMING_SOON: { id: string; title: string; summary: string }[] = [
  { id: "ai-engineering", title: "AI engineering", summary: "Building with models, end to end." },
  {
    id: "software-architecture",
    title: "Software architecture",
    summary: "Boundaries, trade-offs and structure.",
  },
  { id: "data-engineering", title: "Data engineering", summary: "Pipelines, storage and quality." },
  {
    id: "frontend-engineering",
    title: "Frontend engineering",
    summary: "Rendering, state and performance.",
  },
];

/** True when any value anywhere in the item is a `{ kind: "gap" }` src (authored by us, not sourced). */
export function hasGap(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasGap);
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.kind === "gap") return true;
  return Object.values(o).some(hasGap);
}

function trackDirs(): string[] {
  const root = contentRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => !d.startsWith("_") && isSafeId(d));
}

export function loadLandingTracks(): LandingTrack[] {
  const live: (LandingTrack & { order: number })[] = [];
  const soon = new Map<string, LandingTrack & { order: number }>();
  const stub = (id: string, title: string, summary: string, order: number) =>
    ({
      id,
      title,
      summary,
      status: "soon",
      counts: { concepts: 0, problems: 0, questions: 0 },
      addedByUs: false,
      concepts: [],
      problemIds: [],
      order,
    }) satisfies LandingTrack & { order: number };
  COMING_SOON.forEach((c, i) => soon.set(c.id, stub(c.id, c.title, c.summary, 1000 + i)));

  for (const dir of trackDirs()) {
    const meta = loadTrackMeta(dir);
    if (!meta) continue;
    const pack = meta.status === "live" ? loadTrack(dir) : null;
    // A "live" track with nothing approved yet is shown as coming soon: only approved content is served.
    if (pack && pack.concepts.length + pack.problems.length > 0) {
      const qs = [...pack.questions.values()];
      live.push({
        id: meta.id,
        title: meta.title || titleFromId(meta.id),
        summary: meta.summary,
        status: "live",
        counts: {
          concepts: pack.concepts.length,
          problems: pack.problems.length,
          questions: qs.length,
        },
        addedByUs: [...pack.concepts, ...pack.problems].some(hasGap),
        concepts: pack.concepts.map((c) => ({
          id: c.id,
          quickCheckIds: qs.filter((q) => q.conceptId === c.id).map((q) => q.id),
        })),
        problemIds: pack.problems.map((p) => p.id),
        order: meta.order,
      });
      soon.delete(meta.id);
    } else {
      soon.set(
        meta.id,
        stub(meta.id, meta.title, meta.summary, soon.get(meta.id)?.order ?? 1000 + meta.order),
      );
    }
  }
  const strip = (t: LandingTrack & { order: number }): LandingTrack => {
    const { order, ...rest } = t;
    void order;
    return rest;
  };
  return [
    ...live.sort((a, b) => a.order - b.order),
    ...[...soon.values()].sort((a, b) => a.order - b.order),
  ].map(strip);
}
