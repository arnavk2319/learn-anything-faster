import type { Metadata } from "next";

// T-077 e2e fixture for the v2 / compact tokens. Not linked, not indexed.
export const metadata: Metadata = {
  title: "Token preview",
  robots: { index: false, follow: false },
};

function Samples({ id }: { id: string }) {
  return (
    <section
      id={id}
      className="rounded-lg border border-border-firm bg-card p-4 shadow-1 transition-transform duration-(--dur-lift)"
    >
      <h1 data-sample="h1" className="font-display">
        Heading one
      </h1>
      <h2 data-sample="h2" className="font-display">
        Heading two
      </h2>
      <p data-sample="body">Body text sample.</p>
      <button
        type="button"
        data-sample="control"
        className="hit-area h-control-md rounded-md border border-input bg-card px-3 transition-transform duration-(--dur-press) active:scale-(--press-scale)"
      >
        Control
      </button>
    </section>
  );
}

export default function TokenPreviewPage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div data-ui="v2" data-density="compact" data-testid="compact">
        <Samples id="compact-samples" />
      </div>
      <div data-testid="default">
        <Samples id="default-samples" />
      </div>
    </main>
  );
}
