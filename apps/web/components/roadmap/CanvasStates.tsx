"use client";
// Non-graph states of the roadmap canvas: loading, error, empty, and the uncurated pair (404).
import { TransitionRequestForm } from "../forms/TransitionRequestForm";

const shell =
  "canvas-dots rounded-lg border border-border flex min-h-96 flex-1 flex-col items-center justify-center gap-4 p-8 text-center";

// T-062: skeleton with the same footprint as the loaded canvas (graph, >= 640px) or list (< 640px),
// so nothing moves when the roadmap arrives. The right rail is not reserved: the topic panel only
// takes space once a topic is selected. Pulse is motion-safe only; reduced motion gets static blocks.
const block = "rounded-md bg-lane motion-safe:animate-pulse";

export function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading your roadmap"
      data-testid="roadmap-skeleton"
      className="canvas-contour flex min-h-48 flex-1 flex-col overflow-hidden border-t border-border"
    >
      <span className="sr-only">Loading your roadmap</span>
      <div
        aria-hidden="true"
        data-skeleton="list"
        className="flex flex-col gap-3 px-4 py-3 sm:hidden"
      >
        <div className={`${block} h-9 w-48`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <div className={`${block} h-4 w-2/3`} />
            <div className={`${block} h-3 w-full`} />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        data-skeleton="graph"
        className="hidden min-h-0 flex-1 items-center justify-center gap-10 p-8 sm:flex"
      >
        {[2, 3, 2].map((n, col) => (
          <div key={col} className="flex flex-col gap-8">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className={`${block} h-14 w-40 border border-border`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={shell}>
      <p className="font-display text-xl font-semibold">We couldn&apos;t load this roadmap.</p>
      <p className="text-muted-foreground">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-10 cursor-pointer items-center rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors duration-[var(--dur-fast)] hover:border-input hover:bg-lane active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className={shell}>
      <p className="font-display text-xl font-semibold">Nothing new to learn for this move.</p>
      <p className="text-muted-foreground">
        Your current role already covers every topic the target role needs.
      </p>
    </div>
  );
}

export function UnmappedState({
  fromId,
  toId,
  fromName,
  toName,
}: {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
}) {
  return (
    <div className={shell} data-state="unmapped">
      <div className="trail-line w-48" data-state="unmapped" aria-hidden="true" />
      <p className="font-display text-xl font-semibold">
        {fromName} to {toName} isn&apos;t mapped yet.
      </p>
      <p className="max-w-md text-muted-foreground">
        Request this move and we&apos;ll email you when it&apos;s ready.
      </p>
      <div className="w-full max-w-sm text-left">
        <TransitionRequestForm fromRole={fromId} toRole={toId} kind="request" />
      </div>
    </div>
  );
}
