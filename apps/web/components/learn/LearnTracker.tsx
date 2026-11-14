"use client";
// Marks the item seen and remembers where the learner left off (ADR-0015 section 6). Renders nothing.
import { useEffect } from "react";
import { markSeen, readProgress, setLast, writeProgress } from "@/lib/learn/progress";

export function LearnTracker({
  trackId,
  kind,
  id,
}: {
  trackId: string;
  kind: "concept" | "problem";
  id: string;
}) {
  useEffect(() => {
    const at = Date.now();
    writeProgress(setLast(markSeen(readProgress(), id, at), { trackId, kind, id, at }));
  }, [trackId, kind, id]);
  return null;
}
