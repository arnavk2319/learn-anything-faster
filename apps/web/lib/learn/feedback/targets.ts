// Existence check of a feedback target against the approved Learn content index (ADR-0017 section 3).
import { loadTrack, loadTrackMeta, type TrackPack } from "../content";
import type { FeedbackTargetKind } from "./schemas";

/** Pure check against a loaded pack. `block` ids are `<itemId>/<blockId>`; `track` needs the track id itself. */
export function targetExistsIn(pack: TrackPack, kind: FeedbackTargetKind, id: string): boolean {
  switch (kind) {
    case "concept":
      return pack.concepts.some((c) => c.id === id);
    case "problem":
      return pack.problems.some((p) => p.id === id);
    case "question":
      return pack.questions.has(id);
    case "sim":
      return pack.sims.some((s) => s.id === id);
    case "track":
      return pack.track.id === id;
    case "block": {
      const [itemId, blockId, ...rest] = id.split("/");
      if (!itemId || !blockId || rest.length > 0) return false;
      const concept = pack.concepts.find((c) => c.id === itemId);
      if (concept)
        return Object.values(concept.levels).some((bs) => bs?.some((b) => b.id === blockId));
      const problem = pack.problems.find((p) => p.id === itemId);
      return !!problem?.blocks.some((b) => b.id === blockId);
    }
  }
}

/** Reads the (cached) approved content index. Unknown or non-live tracks never exist. */
export function feedbackTargetExists(
  trackId: string,
  kind: FeedbackTargetKind,
  id: string,
): boolean {
  const pack = loadTrack(trackId);
  if (!pack) return kind === "track" && loadTrackMeta(trackId)?.id === id; // coming-soon tracks can still be rated
  return targetExistsIn(pack, kind, id);
}
