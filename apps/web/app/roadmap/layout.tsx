import type { ReactNode } from "react";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { RoadmapProviders } from "./providers";

// Shell header (compact, 64px) above the roadmap; the graph area below is unchanged.
export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-160 flex-col">
      <SiteHeader compact />
      <RoadmapProviders>{children}</RoadmapProviders>
    </div>
  );
}
