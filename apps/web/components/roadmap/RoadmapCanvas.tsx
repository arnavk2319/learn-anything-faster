"use client";
// React Flow wrapper: contour canvas, toolbar, pan and zoom (DESIGN.md section 12 settings).
// Presentational: receives an already laid-out graph and reports toggles upward.
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { readExtraPrefs, writeUiPrefs } from "../../lib/shell/rail";
import { AREA_TYPE, TOPIC_TYPE, type FlowGraph } from "../../lib/roadmap/layout";
import { AreaLane } from "./AreaLane";
import { usePrefersReducedMotion } from "../../lib/roadmap/use-prefers-reduced-motion";
import { CanvasHint } from "./CanvasHint";
import { CanvasToolbar, CoveredToggle } from "./CanvasToolbar";
import { DotGridLayer } from "./DotGridLayer";
import { PrereqEdge } from "./PrereqEdge";
import { TopicNode } from "./TopicNode";

const nodeTypes = { [TOPIC_TYPE]: TopicNode, [AREA_TYPE]: AreaLane };
const edgeTypes = { prereq: PrereqEdge };
// Fit keeps clear of the floating hint (top left) and toolbar (top right) so neither covers Start or a topic.
const FIT = { padding: { top: "68px", right: "76px", bottom: "24px", left: "24px" } } as const;
const MOVE = { duration: 200 };
const STILL = { duration: 0 };
// Soft edge vignette: the one decorative gradient the canvas adds (ADR-0016 amendment 1).
const VIGNETTE =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_58%,color-mix(in_srgb,var(--pine)_11%,transparent)_100%)]";
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
  const move = reduced ? STILL : MOVE;
  const fit = () => void rf.fitView({ ...FIT, ...move });

  // Hint: shown until the first wheel, drag or click; remembered in laf:ui:v1 (graphHintDismissed).
  const [hintOpen, setHintOpen] = useState(false);
  useEffect(() => {
    setHintOpen(!readExtraPrefs(window.localStorage).graphHintDismissed);
  }, []);
  const dismissHint = useCallback(() => {
    setHintOpen(false);
    writeUiPrefs({ graphHintDismissed: true }, window.localStorage);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea")) return;
    if (e.key === "+" || e.key === "=") void rf.zoomIn(move);
    else if (e.key === "-") void rf.zoomOut(move);
    else if (e.key === "0") fit();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CoveredToggle
        coveredCount={coveredCount}
        showCovered={showCovered}
        onToggleCovered={onToggleCovered}
      />
      <div
        data-testid="roadmap-canvas"
        onKeyDown={onKeyDown}
        onPointerDownCapture={hintOpen ? dismissHint : undefined}
        onWheelCapture={hintOpen ? dismissHint : undefined}
        className="canvas-contour relative min-h-48 flex-1 overflow-hidden border-t border-border"
      >
        <ReactFlowRenderer nodes={nodes} edges={graph.edges} />
        <div aria-hidden="true" data-testid="canvas-vignette" className={VIGNETTE} />
        {hintOpen && <CanvasHint onDismiss={dismissHint} />}
        <CanvasToolbar
          onZoomIn={() => void rf.zoomIn(move)}
          onZoomOut={() => void rf.zoomOut(move)}
          onFit={fit}
          onHelp={() => setHintOpen(true)}
        />
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
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      colorMode="light"
      className="bg-transparent!"
    >
      <DotGridLayer />
      <MiniMap
        pannable
        zoomable
        ariaLabel="Roadmap minimap"
        position="bottom-right"
        nodeStrokeWidth={0}
        nodeColor="var(--border-firm)"
        maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
        maskStrokeColor="var(--route)"
        maskStrokeWidth={2}
        className="hidden! rounded-md! border! border-border-firm! bg-card! shadow-[var(--shadow-rest)]! min-[1100px]:block!"
      />
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
