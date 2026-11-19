"use client";
import { Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onFit,
  coveredCount,
  showCovered,
  onToggleCovered,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  coveredCount: number;
  showCovered: boolean;
  onToggleCovered: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Roadmap canvas"
      className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 md:px-6"
    >
      <div role="group" aria-label="Zoom" className="flex gap-2">
        <Button variant="secondary" size="sm" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus aria-hidden="true" className="size-4" />
        </Button>
        <Button variant="secondary" size="sm" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus aria-hidden="true" className="size-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={onFit}>
          <Maximize2 aria-hidden="true" className="size-4" />
          Fit
        </Button>
      </div>
      {coveredCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={showCovered}
          onClick={onToggleCovered}
          className={cn(showCovered && "border-route bg-known text-route")}
        >
          {showCovered ? "Hide what you know" : `Show what you already know (${coveredCount})`}
        </Button>
      )}
    </div>
  );
}
