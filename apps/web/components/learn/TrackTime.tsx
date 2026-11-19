import { formatEstimate } from "@/lib/learn/estimate";

/** Track overview time estimate, hours only. Renders nothing when there is no total. */
export function TrackTime({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  return (
    <span data-testid="track-time" className="tabular-nums">
      {formatEstimate(minutes)}
    </span>
  );
}
