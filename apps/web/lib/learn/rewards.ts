// Pure reward rules (ADR-0016 section 7 and the 2026-11-18 clarification). No React, no DOM, no storage.
import { isConceptDone, isTopicOpened, markTopicOpened, type Progress } from "./progress";

export type RewardKind = "correct" | "finished" | "first-opened";

export interface Reward {
  kind: RewardKind;
  title: string;
  /** Optional link, e.g. the next concept. */
  link?: { href: string; label: string };
  /** Whether a burst may be drawn for this reward (still gated by motion and the Celebrations switch). */
  burst: boolean;
}

export const BURST_GAP_MS = 2000;

/** A correct answer rewards unless the stored answer for that question was already correct. */
export function correctRewards(previouslyCorrect: boolean | undefined, correct: boolean): boolean {
  return correct && previouslyCorrect !== true;
}

/** Concept finished: fires only on the not-done to done transition (derived, nothing stored). */
export function conceptJustFinished(
  before: Progress,
  after: Progress,
  concept: { id: string; quickCheckIds: string[] },
): boolean {
  return (
    !isConceptDone(before, concept.id, concept.quickCheckIds) &&
    isConceptDone(after, concept.id, concept.quickCheckIds)
  );
}

/** First module of a topic: fires once, and the returned progress carries the flag. */
export function openTopic(p: Progress, trackId: string): { fire: boolean; next: Progress } {
  if (isTopicOpened(p, trackId)) return { fire: false, next: p };
  return { fire: true, next: markTopicOpened(p, trackId) };
}

/** At most one burst per BURST_GAP_MS. */
export function burstAllowed(lastBurstAt: number | null, now: number): boolean {
  return lastBurstAt === null || now - lastBurstAt >= BURST_GAP_MS;
}
