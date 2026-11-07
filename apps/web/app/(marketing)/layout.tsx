import type { ReactNode } from "react";
import { SiteHeader } from "@/components/brand/SiteHeader";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
