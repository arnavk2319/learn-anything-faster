/** Format a total in minutes as hours only (ADR-0015 amendment 2). No pace wording. */
export function formatEstimate(totalMinutes: number): string {
  if (totalMinutes < 60) return "Under 1 hour";
  const hours = Math.max(1, Math.round(totalMinutes / 60));
  return hours === 1 ? "About 1 hour" : `About ${hours} hours`;
}

/**
 * Total authored minutes over a track's approved concept and problem items. Items without `estMin`
 * add nothing; null when no approved item has one (the overview then renders no time at all).
 */
export function sumTrackMinutes(
  items: readonly { status: string; estMin?: number | undefined }[],
): number | null {
  let total = 0;
  let any = false;
  for (const i of items) {
    if (i.status !== "approved" || i.estMin === undefined) continue;
    total += i.estMin;
    any = true;
  }
  return any ? total : null;
}
