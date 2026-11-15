"use client";
// Concepts / Problems tabs. Each tab is a real link to its own URL (Concepts is the track root), so the
// tablist is a progressive enhancement: arrow keys, Home and End move focus, Enter or click navigates.
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";

export interface TabDef {
  id: string;
  label: string;
  count: number;
  href: string;
}

export function TrackTabs({ tabs, active }: { tabs: TabDef[]; active: string }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
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
    <div role="tablist" aria-label="Track sections" className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <Link
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls="track-panel"
            tabIndex={selected ? 0 : -1}
            href={t.href}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-5 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            <span className="rounded-pill bg-lane px-2 text-sm tabular-nums">{t.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
