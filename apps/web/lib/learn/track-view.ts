// Pure view logic for the track page (ADR-0015 sections 4-6). No React, no storage access.
import type { Progress } from "./progress";

export const LEVELS = ["basic", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export interface ConceptRow {
  id: string;
  title: string;
  summary: string;
  stage: Level;
  hasSim: boolean;
  /** Ids of this concept's approved quick-check questions. */
  quickCheckIds: string[];
}

export interface ProblemRow {
  id: string;
  title: string;
  summary: string;
  difficulty: string;
  priority: boolean;
  hasSim: boolean;
}

/** Groups concepts by stage in basic, intermediate, advanced order, dropping empty levels. Keeps input order. */
export function groupByLevel<T extends { stage: Level }>(rows: T[]): { level: Level; rows: T[] }[] {
  return LEVELS.map((level) => ({ level, rows: rows.filter((r) => r.stage === level) })).filter(
    (g) => g.rows.length > 0,
  );
}

/** Concept progress as done/total units: 1 for seen plus one per quick check answered. */
export function conceptUnits(p: Progress, row: Pick<ConceptRow, "id" | "quickCheckIds">) {
  const total = 1 + row.quickCheckIds.length;
  const seen = p.items[row.id]?.seenAt !== undefined ? 1 : 0;
  const answered = row.quickCheckIds.filter((q) => p.answers[q] !== undefined).length;
  const done = seen + answered;
  return { done, total, ratio: done / total, complete: done === total };
}

export interface ContinueTarget {
  href: string;
  title: string;
  kind: "concept" | "problem";
}

/**
 * Where "Continue" points: `last` when it belongs to this track and still resolves to an approved
 * item. Otherwise null (button hidden). Question sets are not built yet, so `set` yields null.
 */
export function continueTarget(
  last: Progress["last"],
  trackId: string,
  concepts: { id: string; title: string }[],
  problems: { id: string; title: string }[],
): ContinueTarget | null {
  if (!last || last.trackId !== trackId) return null;
  if (last.kind === "concept") {
    const c = concepts.find((x) => x.id === last.id);
    return c
      ? { href: `/learn/${trackId}/concepts/${c.id}`, title: c.title, kind: "concept" }
      : null;
  }
  if (last.kind === "problem") {
    const pr = problems.find((x) => x.id === last.id);
    return pr
      ? { href: `/learn/${trackId}/problems/${pr.id}`, title: pr.title, kind: "problem" }
      : null;
  }
  return null;
}

export function percent(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}
