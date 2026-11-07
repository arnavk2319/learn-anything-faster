import Link from "next/link";
import { SEED_FROM_ID, SEED_TO_ID, roadmapHref } from "@/lib/landing-preview";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { NavLinks, type NavItem } from "./NavLinks";

export const NAV_ITEMS: NavItem[] = [
  { href: "/roadmaps", label: "Browse roadmaps" },
  { href: roadmapHref(SEED_FROM_ID, SEED_TO_ID), label: "See an example" },
];

// The one header. Shell layouts render it; feature pages never re-implement it (DESIGN.md section 12).
// 72px on marketing pages, 64px (compact) on the roadmap.
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between px-4 md:px-16",
        compact ? "h-16" : "h-18",
      )}
    >
      <Link
        href="/"
        className="text-foreground no-underline hover:text-foreground focus-visible:rounded-mark"
      >
        <Logo />
      </Link>
      <NavLinks items={NAV_ITEMS} />
    </header>
  );
}
