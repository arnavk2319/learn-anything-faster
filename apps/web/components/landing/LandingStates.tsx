"use client";
// Loading and error states for the marketing pages (DESIGN.md section 8). Presentational.
export function LandingLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="flex flex-1 flex-col gap-6 px-4 py-14 md:px-16"
    >
      <div className="h-14 max-w-3xl rounded-lg bg-muted motion-safe:animate-pulse" />
      <div className="h-13 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
      <span className="sr-only" role="status">
        Loading roadmaps
      </span>
    </main>
  );
}

export function LandingError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-start gap-4 px-4 py-14 md:px-16">
      <h1 className="text-[22px] leading-tight font-semibold md:text-[28px]">
        We could not load the roadmaps
      </h1>
      <p role="alert" className="text-muted-foreground">
        Something went wrong on our side. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 rounded-md bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Try again
      </button>
    </main>
  );
}
