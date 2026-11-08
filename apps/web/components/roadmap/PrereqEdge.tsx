"use client";
// Prerequisite edge: dashed Stone (.edge-unmet); the selected topic's edges get a solid Trail overlay (.edge-hot) that draws in.
// The path follows ELK's orthogonal route (rounded corners); with no route it falls back to a bezier.
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { edgeTouches, type RoutePoint } from "../../lib/roadmap/layout";
import { useSelectedTopicId } from "../../lib/roadmap/selection-store";
import { usePrefersReducedMotion } from "../../lib/roadmap/use-prefers-reduced-motion";

const CORNER = 8;

/** Polyline through `pts` with each inner corner rounded by a quadratic curve. */
export function roundedPath(pts: readonly RoutePoint[], radius = CORNER): string {
  const first = pts[0];
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i] as RoutePoint;
    const prev = pts[i - 1] as RoutePoint;
    const next = pts[i + 1];
    if (!next) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r <= 0) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const a = {
      x: cur.x - ((cur.x - prev.x) / inLen) * r,
      y: cur.y - ((cur.y - prev.y) / inLen) * r,
    };
    const b = {
      x: cur.x + ((next.x - cur.x) / outLen) * r,
      y: cur.y + ((next.y - cur.y) / outLen) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  return d;
}

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
  const { pairs, points } = data as {
    pairs: { topicId: string; prerequisiteId: string }[];
    points?: RoutePoint[];
  };
  const hot = edgeTouches(pairs, selected);
  const path =
    points && points.length >= 2
      ? roundedPath(points)
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0];
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
