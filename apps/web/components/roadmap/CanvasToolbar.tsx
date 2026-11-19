"use client";
import { HelpCircle, Maximize2, Minus, Plus, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

function ToolButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        onClick={onClick}
        className="size-11! p-0!"
      >
        <Icon aria-hidden="true" className="size-5" />
      </Button>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-md border border-border-firm bg-card px-2 py-1 text-[length:var(--text-small)] whitespace-nowrap text-foreground opacity-0 shadow-[var(--shadow-rest)] group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

/** Floating zoom controls pinned top right of the canvas. The prototype has it bottom left, but the Next.js dev indicator
 * sits in that corner and swallows clicks in dev and e2e; top right is also clear of the hint and the minimap.. */
export function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onFit,
  onHelp,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onHelp: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Roadmap canvas"
      aria-orientation="vertical"
      className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-lg border border-border-firm bg-card p-1 shadow-[var(--shadow-rest)]"
    >
      <ToolButton label="Zoom in" icon={Plus} onClick={onZoomIn} />
      <ToolButton label="Zoom out" icon={Minus} onClick={onZoomOut} />
      <ToolButton label="Fit to screen" icon={Maximize2} onClick={onFit} />
      <ToolButton label="Show hint" icon={HelpCircle} onClick={onHelp} />
    </div>
  );
}

/** "Show what you already know" switch; sits above the canvas, only when something is covered. */
export function CoveredToggle({
  coveredCount,
  showCovered,
  onToggleCovered,
}: {
  coveredCount: number;
  showCovered: boolean;
  onToggleCovered: () => void;
}) {
  if (coveredCount <= 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 md:px-6">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={showCovered}
        onClick={onToggleCovered}
        className={cn(showCovered && "border-route bg-known text-route")}
      >
        {showCovered ? "Hide what you know" : `Show what you already know (${coveredCount})`}
      </Button>
    </div>
  );
}
