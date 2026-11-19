"use client";
// In-page heading outline (T-080). Renders into the shell right rail ("On this page", ADR-0016 section 4) via a
// portal; renders nothing outside the shell. Headings are discovered from the DOM (h1 and h2 of the main column), so
// block content stays untouched. Scroll-spy marks the last heading above the threshold; a click scrolls to the
// heading and moves focus to it (headings get tabindex=-1).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useShellSlots } from "@/lib/shell/context";
import { railRow } from "@/components/shell/LearnShell";
import { cn } from "@/lib/utils";

interface Entry {
  id: string;
  text: string;
}

const SPY_OFFSET = 120;
const ring = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

function slug(text: string, taken: Set<string>): string {
  const base = `h-${
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  }`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function OnThisPage() {
  const slots = useShellSlots();
  const slot = slots?.onPage ?? null;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) return;
    const heads = [...document.querySelectorAll<HTMLElement>("#main-content h1, #main-content h2")];
    const taken = new Set(heads.map((h) => h.id).filter(Boolean));
    const found: Entry[] = [];
    for (const h of heads) {
      if (!h.id) h.id = slug(h.textContent ?? "", taken);
      taken.add(h.id);
      h.tabIndex = -1;
      h.classList.add("scroll-mt-4", "focus:outline-none");
      found.push({ id: h.id, text: h.textContent ?? "" });
    }
    setEntries(found);

    let raf = 0;
    const update = () => {
      raf = 0;
      let cur = found[0]?.id ?? null;
      for (const f of found) {
        const el = document.getElementById(f.id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET) cur = f.id;
      }
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    // Scroll does not bubble; capture catches whichever ancestor is the scroller at this breakpoint.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slot]);

  if (!slot || entries.length < 2) return null;

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
    setActive(id);
  };

  return createPortal(
    <nav aria-label="On this page" data-testid="on-this-page">
      <h2 className="px-2.5 pt-1 pb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        On this page
      </h2>
      <ul className="flex flex-col">
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              data-heading={e.id}
              aria-current={e.id === active ? "location" : undefined}
              onClick={(ev) => {
                ev.preventDefault();
                go(e.id);
              }}
              className={cn(
                railRow,
                "aria-[current=location]:bg-muted aria-[current=location]:font-semibold aria-[current=location]:shadow-[inset_3px_0_0_var(--route)]",
                ring,
              )}
            >
              <span className="min-w-0 flex-1 truncate" title={e.text}>
                {e.text}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>,
    slot,
  );
}
