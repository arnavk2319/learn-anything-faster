"use client";
// Graph / List switch (F10). Graph is the default; this only reports the choice upward.
import { cn } from "../../lib/utils";
import { focusRing } from "../ui/tactile";

export type View = "graph" | "list";

const seg =
  "hit-area inline-flex h-control-md min-w-16 cursor-pointer items-center justify-center px-3 text-(length:--text-ui) font-medium transition-colors duration-(--dur-fast) hover:bg-lane focus-visible:outline-offset-[-2px]";

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-input bg-card shadow-1"
    >
      {(["graph", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn(
            seg,
            focusRing,
            view === v && "bg-known text-known-foreground shadow-[inset_0_-2px_0_var(--route)]",
          )}
        >
          {v === "graph" ? "Graph" : "List"}
        </button>
      ))}
    </div>
  );
}
