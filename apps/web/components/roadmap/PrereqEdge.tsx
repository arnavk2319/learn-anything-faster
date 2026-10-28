"use client";
// Prerequisite edge: resting Edge colour; the selected topic's edges become 3.5px Trail.
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "../../lib/utils";
import { edgeTouches } from "../../lib/roadmap/layout";
import { useSelectedTopicId } from "../../lib/roadmap/selection-store";

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
    <BaseEdge
      id={id}
      path={path}
      className={cn(
        "fill-none transition-[stroke,stroke-width] duration-[var(--dur-fast)]",
        hot ? "stroke-route stroke-[3.5px]" : "stroke-edge stroke-[1.5px]",
      )}
      interactionWidth={0}
    />
  );
}
