import type { ReactNode } from "react";
import { SiteHeader } from "@/components/brand/SiteHeader";

// Browse shell (ADR-0016, T-088): v2 tokens + compact tier, 48px header; the page's main scrolls inside the viewport.
export default function BrowseLayout({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}
