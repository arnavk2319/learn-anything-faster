"use client";
// Non-graph states of the roadmap canvas: loading, error, empty, and the uncurated pair (404).
import { TransitionRequestForm } from "../forms/TransitionRequestForm";

const shell =
  "canvas-dots rounded-lg border border-border flex min-h-96 flex-1 flex-col items-center justify-center gap-4 p-8 text-center";

export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className={shell}>
      <div className="trail-line w-48" aria-hidden="true" />
      <p className="text-muted-foreground">Building your roadmap</p>
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
