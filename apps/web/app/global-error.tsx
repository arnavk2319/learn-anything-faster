"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches React render errors in the root layout and reports them (no-op without a DSN).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main className="p-8">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p>Please reload the page.</p>
        </main>
      </body>
    </html>
  );
}
