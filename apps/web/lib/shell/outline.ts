// Pure outline model for the Learn shell: the track's approved concepts (by level) and problems.
import type { Concept, Problem } from "../learn/schemas";
import { LEVELS, type Level } from "../learn/track-view";

export interface OutlineItem {
  kind: "concept" | "problem" | "track";
  id: string;
  title: string;
  href: string;
  /** Approved quick-check question ids (concepts only); used for the done marker. */
  quickCheckIds: string[];
}
export interface OutlineGroup {
  key: string;
  label: string;
  items: OutlineItem[];
}

const LEVEL_LABEL: Record<Level, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function buildOutline(
  trackId: string,
  concepts: Concept[],
  problems: Problem[],
  quickChecks: (conceptId: string) => string[],
): OutlineGroup[] {
  const groups: OutlineGroup[] = LEVELS.map((level) => ({
    key: level,
    label: LEVEL_LABEL[level],
    items: concepts
      .filter((c) => c.stage === level)
      .map((c) => ({
        kind: "concept" as const,
        id: c.id,
        title: c.title,
        href: `/learn/${trackId}/concepts/${c.id}`,
        quickCheckIds: quickChecks(c.id),
      })),
  }));
  groups.push({
    key: "problems",
    label: "Problems",
    items: problems.map((p) => ({
      kind: "problem" as const,
      id: p.id,
      title: p.title,
      href: `/learn/${trackId}/problems/${p.id}`,
      quickCheckIds: [],
    })),
  });
  return groups.filter((g) => g.items.length > 0);
}

/** Items after the current one in outline order (wraps to nothing at the end). */
export function nextUp(groups: OutlineGroup[], currentId: string, limit = 5): OutlineItem[] {
  const flat = groups.flatMap((g) => g.items);
  const i = flat.findIndex((x) => x.id === currentId);
  return flat.slice(i + 1, i + 1 + limit);
}
