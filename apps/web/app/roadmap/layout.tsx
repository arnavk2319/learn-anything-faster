import type { ReactNode } from "react";
import { APP_NAME } from "../../../../lib/brand";
import { RoadmapProviders } from "./providers";

// Roadmap header (64px). The root shell has no shared header yet; this is replaced when it does.
export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-160 flex-col">
      <header className="flex h-16 shrink-0 items-center px-8">
        <a
          href="/"
          className="flex items-center gap-2.5 font-display text-[22px] font-bold text-foreground no-underline"
        >
          <span
            aria-hidden="true"
            className="inline-block h-5 w-3.5 rounded-[4px] border-2 border-primary bg-highlight"
          />
          {APP_NAME}
        </a>
      </header>
      <RoadmapProviders>{children}</RoadmapProviders>
    </div>
  );
}
