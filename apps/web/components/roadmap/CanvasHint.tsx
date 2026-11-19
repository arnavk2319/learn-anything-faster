"use client";
import { X } from "lucide-react";
import { Button } from "../ui/button";

// First-visit interactivity cue (ADR-0016 amendment 1). Static: no entrance animation, so nothing to reduce.
export function CanvasHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      data-testid="canvas-hint"
      className="absolute top-3 left-3 z-10 flex min-h-11 items-center gap-1 rounded-full border border-border-firm bg-card py-0 pr-1 pl-3.5 text-[length:var(--text-small)] text-foreground shadow-[var(--shadow-rest)]"
    >
      <span>Scroll to zoom, drag to pan, click a topic</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Dismiss hint"
        onClick={onDismiss}
        className="size-11! rounded-full p-0!"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
