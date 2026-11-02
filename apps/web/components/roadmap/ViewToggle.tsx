"use client";
// Graph / List switch (F10). Graph is the default; this only reports the choice upward.
import { cn } from "../../lib/utils";

export type View = "graph" | "list";

const seg =
  "inline-flex h-10 min-w-16 cursor-pointer items-center justify-center px-3 text-sm font-medium transition-colors duration-[var(--dur-fast)] hover:bg-lane";

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex overflow-hidden rounded-md border border-border bg-card"
    >
      {(["graph", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn(seg, view === v && "bg-highlight text-highlight-foreground")}
        >
          {v === "graph" ? "Graph" : "List"}
        </button>
      ))}
    </div>
  );
}
