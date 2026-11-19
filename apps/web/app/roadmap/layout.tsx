import type { ReactNode } from "react";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { RoadmapProviders } from "./providers";

// Roadmap shell (ADR-0016, T-086): v2 tokens + compact tier, 48px header, main fills the rest of the viewport.
export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-ui="v2"
      data-density="compact"
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-mark focus:bg-card focus:px-3 focus:py-2 focus:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Skip to content
      </a>
      <SiteHeader dense />
      <RoadmapProviders>{children}</RoadmapProviders>
    </div>
  );
}
