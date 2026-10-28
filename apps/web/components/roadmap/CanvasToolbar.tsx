"use client";
import { Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

const btn =
  "border-border hover:border-input hover:bg-lane bg-card text-foreground inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-[var(--dur-fast)] active:scale-[0.98]";

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
    <div role="toolbar" aria-label="Roadmap canvas" className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Zoom" className="flex gap-1">
        <button type="button" className={btn} aria-label="Zoom out" onClick={onZoomOut}>
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className={btn} aria-label="Zoom in" onClick={onZoomIn}>
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className={btn} onClick={onFit}>
          <Maximize2 aria-hidden="true" className="size-4" />
          Fit
        </button>
      </div>
      {coveredCount > 0 && (
        <button
          type="button"
          aria-pressed={showCovered}
          onClick={onToggleCovered}
          className={cn(btn, showCovered && "border-route bg-known text-route")}
        >
          {showCovered ? "Hide what you know" : `Show what you already know (${coveredCount})`}
        </button>
      )}
    </div>
  );
}
