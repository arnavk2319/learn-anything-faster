import type { ReactNode } from "react";
import { SiteHeader } from "@/components/brand/SiteHeader";

export default function LearnTrackLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
