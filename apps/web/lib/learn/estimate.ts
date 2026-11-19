/** Format a total in minutes as hours only (ADR-0015 amendment 2). No pace wording. */
export function formatEstimate(totalMinutes: number): string {
  if (totalMinutes < 60) return "Under 1 hour";
  const hours = Math.max(1, Math.round(totalMinutes / 60));
  return hours === 1 ? "About 1 hour" : `About ${hours} hours`;
}
