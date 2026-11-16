// Pure helpers for the Popular moves cards. Hours come from summarizeRoadmap (no second formula).
import { summarizeRoadmap } from "../../lib/roadmap/summary";

export type CardSummary = { topicCount: number; hours: number };

/** Summary for a live move, from the roadmap nodes the move opens. Null when there is nothing to show. */
export function cardSummary(
  nodes: ReadonlyArray<{ estHours?: number | null }>,
  coveredCount: number,
): CardSummary | null {
  const s = summarizeRoadmap({ topics: nodes, coveredCount });
  return s.topicCount === 0 ? null : { topicCount: s.topicCount, hours: s.totalHours };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function cardMeta(status: string, summary: CardSummary | null): string {
  if (status !== "live") return "Get notified";
  if (!summary) return "Open the roadmap";
  return summary.hours > 0
    ? `${plural(summary.topicCount, "topic", "topics")}, about ${plural(summary.hours, "hour", "hours")}`
    : plural(summary.topicCount, "topic", "topics");
}

export const cardTag = (status: string) => (status === "live" ? "Live" : "Soon");
