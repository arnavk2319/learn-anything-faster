"use client";
// Shared mobile bottom nav (ADR-0016 section 8, T-093). Below 768px only; items are props.
// An item is a button (onSelect) or a link (href). State is either `pressed` (Learn panes, aria-pressed)
// or `current` (aria-current). A disabled item stays focusable with aria-disabled and an announced reason.
// The Learn markup is unchanged: only the props it passes decide which attributes and classes appear.
import Link from "next/link";
import { cn } from "@/lib/utils";

export type BottomNavItem = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  pressed?: boolean;
  current?: boolean;
  /** Set with `reason`: the item is aria-disabled and the reason is read out (and shown as a tooltip). */
  disabled?: boolean;
  reason?: string;
};

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function BottomNav({ label, items }: { label: string; items: BottomNavItem[] }) {
  return (
    <nav
      aria-label={label}
      className="flex shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((n) => {
        const base =
          "min-h-(--bottom-nav-h) flex-1 text-(length:--text-ui) font-medium text-foreground";
        if (n.pressed !== undefined) {
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={n.pressed}
              onClick={n.onSelect}
              className={cn(
                base,
                "aria-pressed:bg-muted aria-pressed:font-semibold aria-pressed:underline",
                ring,
              )}
            >
              {n.label}
            </button>
          );
        }
        const cls = cn(
          base,
          "flex items-center justify-center no-underline",
          "aria-[current=true]:bg-muted aria-[current=true]:font-semibold aria-[current=true]:underline",
          "aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:underline",
          "aria-disabled:text-muted-foreground aria-disabled:cursor-not-allowed",
          ring,
        );
        const cur = n.current ? (n.href && !n.onSelect ? "page" : "true") : undefined;
        if (n.href && !n.disabled) {
          return (
            <Link
              key={n.id}
              href={n.href}
              aria-current={cur}
              className={cls}
              onClick={
                n.onSelect
                  ? (e) => {
                      e.preventDefault();
                      n.onSelect?.();
                    }
                  : undefined
              }
            >
              {n.label}
            </Link>
          );
        }
        return (
          <button
            key={n.id}
            type="button"
            aria-current={cur}
            aria-disabled={n.disabled || undefined}
            title={n.disabled ? n.reason : undefined}
            onClick={n.disabled ? undefined : n.onSelect}
            className={cls}
          >
            {n.label}
            {n.disabled && n.reason ? <span className="sr-only">. {n.reason}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
