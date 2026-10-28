"use client";
// React Flow wrapper: dots background, toolbar, pan and zoom (DESIGN.md section 12 settings).
// Presentational: receives an already laid-out graph and reports toggles upward.
import "@xyflow/react/dist/style.css";
import { useMemo, type KeyboardEvent } from "react";
import { ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { AREA_TYPE, TOPIC_TYPE, type FlowGraph } from "../../lib/roadmap/layout";
import { AreaLane } from "./AreaLane";
import { CanvasToolbar } from "./CanvasToolbar";
import { PrereqEdge } from "./PrereqEdge";
import { TopicNode } from "./TopicNode";

const nodeTypes = { [TOPIC_TYPE]: TopicNode, [AREA_TYPE]: AreaLane };
const edgeTypes = { prereq: PrereqEdge };
const FIT = { padding: 0.08 };
const MOVE = { duration: 200 };
// Re-layout glide (DESIGN.md section 9); reduced motion is handled by the global theme rule.
const MOTION = { transition: "transform var(--dur-slow) var(--ease-trail)" };

interface Props {
  graph: FlowGraph;
  onToggleArea: (areaKey: string) => void;
  coveredCount: number;
  showCovered: boolean;
  onToggleCovered: () => void;
}

function Inner({ graph, onToggleArea, coveredCount, showCovered, onToggleCovered }: Props) {
  const rf = useReactFlow();
  // Lanes get their toggle handler here so layout code stays free of callbacks.
  const nodes = useMemo(
    () =>
      graph.nodes.map((n) =>
        n.type === AREA_TYPE
          ? { ...n, style: MOTION, data: { ...n.data, onToggle: onToggleArea } }
          : { ...n, style: MOTION },
      ),
    [graph.nodes, onToggleArea],
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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
        className="canvas-dots min-h-96 flex-1 overflow-hidden rounded-lg border border-border"
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
    />
  );
}

export function RoadmapCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
