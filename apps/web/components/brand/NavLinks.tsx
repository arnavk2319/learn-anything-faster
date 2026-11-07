"use client";
// Header nav. Client only to mark the current page (aria-current, Pine 600 per DESIGN.md section 8).
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-4 text-[15px] font-medium md:gap-7">
      {items.map((i) => {
        const current = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "font-semibold text-foreground no-underline"
                : "text-foreground no-underline hover:text-route-hover hover:underline"
            }
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
