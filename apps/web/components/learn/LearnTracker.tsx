"use client";
// Marks the item seen and remembers where the learner left off (ADR-0015 section 6). Also raises the
// "first module of a topic opened" reward (once per topic, persisted flag) and tells the reward bus which
// concept is on screen so finishing it can be detected (T-083). Renders nothing.
import { useEffect } from "react";
import { markSeen, readProgress, setLast, writeProgress } from "@/lib/learn/progress";
import { openTopic } from "@/lib/learn/rewards";
import { useRewards, type ConceptContext } from "@/components/rewards/RewardsProvider";

export function LearnTracker({
  trackId,
  trackTitle,
  kind,
  id,
  concept,
}: {
  trackId: string;
  trackTitle?: string;
  kind: "concept" | "problem";
  id: string;
  concept?: ConceptContext;
}) {
  const { notify, setConcept } = useRewards();
  const conceptKey = concept ? JSON.stringify(concept) : null;

  useEffect(() => {
    const at = Date.now();
    const opened = openTopic(readProgress(), trackId);
    writeProgress(setLast(markSeen(opened.next, id, at), { trackId, kind, id, at }));
    if (opened.fire && trackTitle) {
      notify({ kind: "first-opened", title: `New on the trail: ${trackTitle}`, burst: false });
    }
  }, [trackId, trackTitle, kind, id, notify]);

  useEffect(() => {
    setConcept(conceptKey ? (JSON.parse(conceptKey) as ConceptContext) : null);
    return () => setConcept(null);
  }, [conceptKey, setConcept]);

  return null;
}
