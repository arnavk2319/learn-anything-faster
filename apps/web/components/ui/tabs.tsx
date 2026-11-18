"use client";
// Underline tabs (DESIGN.md 14.3). Behaviour matches TrackTabs: roving tabindex, arrow keys, Home and End move
// focus, Enter or click activates. Tabs are links when `href` is set, otherwise buttons calling `onSelect`.
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tactile";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  href?: string;
}

const tabBase =
  "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-5 font-medium transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

export function Tabs({
  tabs,
  active,
  label,
  panelId,
  onSelect,
  className,
}: {
  tabs: TabItem[];
  active: string;
  label: string;
  panelId: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    let to: number | null = null;
    if (e.key === "ArrowRight") to = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") to = i === 0 ? last : i - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to === null) return;
    e.preventDefault();
    refs.current[to]?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto border-b border-border-firm", className)}
    >
      {tabs.map((t, i) => {
        const selected = t.id === active;
        const cls = cn(
          tabBase,
          focusRing,
          selected
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        );
        const common = {
          role: "tab",
          id: `tab-${t.id}`,
          "aria-selected": selected,
          "aria-controls": panelId,
          tabIndex: selected ? 0 : -1,
          onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i),
          className: cls,
        } as const;
        const body = (
          <>
            {t.label}
            {t.count === undefined ? null : (
              <span className="rounded-pill bg-lane px-2 text-[length:var(--text-small)] tabular-nums">
                {t.count}
              </span>
            )}
          </>
        );
        return t.href ? (
          <Link
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={t.href}
            {...common}
          >
            {body}
          </Link>
        ) : (
          <button
            key={t.id}
            type="button"
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => onSelect?.(t.id)}
            {...common}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
