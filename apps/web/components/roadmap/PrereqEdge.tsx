"use client";
// Prerequisite edge: dashed Stone (.edge-unmet); the selected topic's edges get a solid Trail overlay (.edge-hot) that draws in.
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { edgeTouches } from "../../lib/roadmap/layout";
import { useSelectedTopicId } from "../../lib/roadmap/selection-store";
import { usePrefersReducedMotion } from "../../lib/roadmap/use-prefers-reduced-motion";

export function PrereqEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const selected = useSelectedTopicId();
  const reduced = usePrefersReducedMotion();
  const pairs = (data as { pairs: { topicId: string; prerequisiteId: string }[] }).pairs;
  const hot = edgeTouches(pairs, selected);
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={path} className="edge-unmet" interactionWidth={0} />
      {hot && (
        <path
          d={path}
          pathLength={1}
          className="edge-hot"
          style={reduced ? { animation: "none", strokeDashoffset: 0 } : undefined}
        />
      )}
    </>
  );
}
