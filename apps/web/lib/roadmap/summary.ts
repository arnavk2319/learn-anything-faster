// Human summary line for the roadmap header. Pure: no React, no DB. Hours only, no weekly pace.
export type RoadmapSummary = {
  topicCount: number;
  totalHours: number;
  coveredCount: number;
  /** null when there is nothing to learn (the empty state covers that case). */
  sentence: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function summarizeRoadmap(input: {
  /** Shown (non-covered) topics only. */
  topics: ReadonlyArray<{ estHours?: number | null }>;
  coveredCount: number;
}): RoadmapSummary {
  const { topics, coveredCount } = input;
  let sum = 0;
  let missing = false;
  for (const t of topics) {
    const h = t.estHours;
    if (typeof h === "number" && Number.isFinite(h) && h >= 0) sum += h;
    else missing = true;
  }
  const totalHours = sum > 0 ? Math.max(1, Math.round(sum)) : 0;
  const topicCount = topics.length;
  if (topicCount === 0) return { topicCount, totalHours, coveredCount, sentence: null };

  let sentence = `${plural(topicCount, "topic", "topics")} to learn`;
  if (totalHours > 0) sentence += `, about ${plural(totalHours, "hour", "hours")}`;
  sentence += ".";
  if (coveredCount > 0) sentence += ` Your role already covers ${coveredCount}.`;
  if (missing) sentence += " Some topics have no estimate yet.";
  return { topicCount, totalHours, coveredCount, sentence };
}
