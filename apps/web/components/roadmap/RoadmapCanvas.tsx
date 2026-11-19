"use client";
// React Flow wrapper: contour canvas, toolbar, pan and zoom (DESIGN.md section 12 settings).
// Presentational: receives an already laid-out graph and reports toggles upward.
import "@xyflow/react/dist/style.css";
import { useMemo, type KeyboardEvent } from "react";
import { ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { AREA_TYPE, TOPIC_TYPE, type FlowGraph } from "../../lib/roadmap/layout";
import { AreaLane } from "./AreaLane";
import { usePrefersReducedMotion } from "../../lib/roadmap/use-prefers-reduced-motion";
import { CanvasToolbar } from "./CanvasToolbar";
import { ContourLayer } from "./ContourLayer";
import { PrereqEdge } from "./PrereqEdge";
import { TopicNode } from "./TopicNode";

const nodeTypes = { [TOPIC_TYPE]: TopicNode, [AREA_TYPE]: AreaLane };
const edgeTypes = { prereq: PrereqEdge };
const FIT = { padding: 0.08 };
const MOVE = { duration: 200 };
// Re-layout glide (DESIGN.md section 9); dropped when the user prefers reduced motion.
const MOTION = { transition: "transform var(--dur-slow) var(--ease-trail)" };

interface Props {
  graph: FlowGraph;
  startId: string | null;
  onToggleArea: (areaKey: string) => void;
  coveredCount: number;
  showCovered: boolean;
  onToggleCovered: () => void;
}

function Inner({
  graph,
  startId,
  onToggleArea,
  coveredCount,
  showCovered,
  onToggleCovered,
}: Props) {
  const rf = useReactFlow();
  const reduced = usePrefersReducedMotion();
  const motion = reduced ? undefined : MOTION;
  // Lanes get their toggle handler here so layout code stays free of callbacks.
  const nodes = useMemo(
    () =>
      graph.nodes.map((n) =>
        n.type === AREA_TYPE
          ? { ...n, style: motion, data: { ...n.data, onToggle: onToggleArea } }
          : n.id === startId
            ? { ...n, style: motion, data: { ...n.data, startHere: true } }
            : { ...n, style: motion },
      ),
    [graph.nodes, onToggleArea, motion, startId],
  );
  const fit = () => void rf.fitView({ ...FIT, ...MOVE });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea")) return;
    if (e.key === "+" || e.key === "=") void rf.zoomIn(MOVE);
    else if (e.key === "-") void rf.zoomOut(MOVE);
    else if (e.key === "0") fit();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CanvasToolbar
        onZoomIn={() => void rf.zoomIn(MOVE)}
        onZoomOut={() => void rf.zoomOut(MOVE)}
        onFit={fit}
        coveredCount={coveredCount}
        showCovered={showCovered}
        onToggleCovered={onToggleCovered}
      />
      <div
        data-testid="roadmap-canvas"
        onKeyDown={onKeyDown}
        className="canvas-contour min-h-48 flex-1 overflow-hidden border-t border-border"
      >
        <ReactFlowRenderer nodes={nodes} edges={graph.edges} />
      </div>
    </div>
  );
}

function ReactFlowRenderer({ nodes, edges }: Pick<FlowGraph, "nodes" | "edges">) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={FIT}
      minZoom={0.4}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      // Wrappers stay out of the tab order: each TopicNode's button is the single tab stop (T-012).
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch
      zoomOnDoubleClick={false}
      preventScrolling={false}
      colorMode="light"
      className="bg-transparent!"
    >
      <ContourLayer />
    </ReactFlow>
  );
}

export function RoadmapCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
