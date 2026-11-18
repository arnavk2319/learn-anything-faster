"use client";
// Learn app shell (ADR-0016 section 4 and 8): 48px header over a left outline rail, fluid main and a right rail.
// Owns layout and rail state only; pages own data. Under 768px it is one pane with a bottom nav.
// SSR-safe: the server and hydration render use a character-count estimate and empty progress; stored
// width, collapse state and progress are read in effects. No transitions anywhere (collapse and drag are instant).
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Logo } from "@/components/brand/Logo";
import {
  emptyProgress,
  isConceptDone,
  readProgress,
  subscribeProgress,
} from "@/lib/learn/progress";
import type { OutlineGroup, OutlineItem } from "@/lib/shell/outline";
import {
  DEFAULT_FRACTION,
  fractionFromWidth,
  railBounds,
  railReducer,
  readUiPrefs,
  widthFromFraction,
  writeUiPrefs,
  type RailAction,
  type RailMetrics,
} from "@/lib/shell/rail";
import { ShellSlotsContext, type ShellSlots } from "@/lib/shell/context";
import { cn } from "@/lib/utils";

type Pane = "outline" | "content" | "next";

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Server and first-paint guess: average glyph width at the 13px compact UI size plus fixed chrome. */
function estimateMetrics(groups: OutlineGroup[]): RailMetrics {
  const longest = Math.max(0, ...groups.flatMap((g) => g.items.map((i) => i.title.length)));
  return { label: Math.ceil(longest * 7), chrome: 56 };
}

const mqSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useIsMobile = () =>
  useSyncExternalStore(
    mqSubscribe,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );

function useStoredProgress() {
  const [p, setP] = useState(emptyProgress);
  useEffect(() => {
    setP(readProgress());
    return subscribeProgress(setP);
  }, []);
  return p;
}

function Dot({ state }: { state: "done" | "seen" | "none" }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-pill border",
          state === "done" && "border-route bg-route",
          state === "seen" && "border-route bg-transparent",
          state === "none" && "border-border-firm bg-transparent",
        )}
      />
      {state !== "none" ? (
        <span className="sr-only">{state === "done" ? "Done" : "Seen"}</span>
      ) : null}
    </>
  );
}

function OutlineList({
  groups,
  currentId,
  onNavigate,
}: {
  groups: OutlineGroup[];
  currentId: string;
  onNavigate: () => void;
}) {
  const progress = useStoredProgress();
  const stateOf = (i: OutlineItem): "done" | "seen" | "none" => {
    if (i.kind === "concept" && isConceptDone(progress, i.id, i.quickCheckIds)) return "done";
    return progress.items[i.id]?.seenAt ? "seen" : "none";
  };
  return (
    <nav aria-label="Outline" className="flex [scrollbar-gutter:stable] flex-col gap-3 py-2">
      {groups.map((g) => (
        <div key={g.key} role="group" aria-labelledby={`outline-${g.key}`}>
          <p
            id={`outline-${g.key}`}
            className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {g.label}
          </p>
          <ul className="flex flex-col">
            {g.items.map((i) => (
              <li key={i.id}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={i.id === currentId ? "page" : undefined}
                  className={cn(
                    "flex min-h-(--row-h) items-center gap-2 rounded-mark px-2 text-(length:--text-ui) text-foreground no-underline hover:bg-muted md:min-h-8",
                    "aria-[current=page]:bg-muted aria-[current=page]:font-semibold",
                    ring,
                  )}
                >
                  <Dot state={stateOf(i)} />
                  <span data-outline-label title={i.title} className="min-w-0 flex-1 truncate">
                    {i.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function LearnShell({
  trackId,
  trackTitle,
  groups,
  currentId,
  next,
  children,
}: {
  trackId: string;
  trackTitle: string;
  groups: OutlineGroup[];
  currentId: string;
  next: OutlineItem[];
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [pane, setPane] = useState<Pane>("content");
  const [measured, setMeasured] = useState<RailMetrics | null>(null);
  const [fraction, setFraction] = useState(DEFAULT_FRACTION);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null);
  const [onPageEl, setOnPageEl] = useState<HTMLElement | null>(null);
  const slots = useMemo<ShellSlots>(
    () => ({
      inspector: inspectorEl,
      onPage: onPageEl,
      expandRight: () => setRightCollapsed(false),
    }),
    [inspectorEl, onPageEl],
  );

  const metrics = measured ?? estimateMetrics(groups);
  const bounds = railBounds(metrics);
  const width = widthFromFraction(fraction, metrics);

  useEffect(() => {
    const prefs = readUiPrefs(window.localStorage);
    setFraction(prefs.rail);
    setRightCollapsed(prefs.rightCollapsed);
  }, []);

  // Measure the longest label's text width (Range, so the ellipsis clip does not hide it) and the constant
  // chrome (rail width minus a label's width). Re-measure once fonts load, on pane change and on resize.
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const labels = [...rail.querySelectorAll<HTMLElement>("[data-outline-label]")];
    const first = labels[0];
    if (!first || first.clientWidth === 0) return; // hidden pane: keep the previous value
    const range = document.createRange();
    let label = 0;
    for (const el of labels) {
      range.selectNodeContents(el);
      label = Math.max(label, range.getBoundingClientRect().width);
    }
    const nm = { label: Math.ceil(label), chrome: rail.offsetWidth - first.clientWidth };
    setMeasured((m) => (m && m.label === nm.label && m.chrome === nm.chrome ? m : nm));
  }, []);
  useEffect(() => {
    measure();
    void document.fonts?.ready.then(measure);
  }, [measure, pane, groups, isMobile]);

  const commit = (action: RailAction) => {
    const w = railReducer(width, action, bounds);
    const f = fractionFromWidth(w, metrics);
    setFraction(f);
    writeUiPrefs({ rail: f }, window.localStorage);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, RailAction | undefined> = {
      ArrowLeft: { type: "step", dir: -1, shift: e.shiftKey },
      ArrowRight: { type: "step", dir: 1, shift: e.shiftKey },
      Home: { type: "min" },
      End: { type: "max" },
    };
    const a = map[e.key];
    if (!a) return;
    e.preventDefault();
    commit(a);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !railRef.current) return;
    const left = railRef.current.getBoundingClientRect().left;
    const w = railReducer(width, { type: "set", width: e.clientX - left }, bounds);
    setFraction(fractionFromWidth(w, metrics));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    writeUiPrefs({ rail: fraction }, window.localStorage);
  };

  const toggleRight = () => {
    const v = !rightCollapsed;
    setRightCollapsed(v);
    writeUiPrefs({ rightCollapsed: v }, window.localStorage);
  };

  const navItems: { pane: Pane; label: string }[] = [
    { pane: "outline", label: "Outline" },
    { pane: "content", label: "Content" },
    { pane: "next", label: "Next" },
  ];

  return (
    <ShellSlotsContext.Provider value={slots}>
      <div
        data-ui="v2"
        data-density="compact"
        className={cn(
          "relative flex h-dvh flex-col overflow-hidden bg-background text-foreground",
          dragging && "select-none",
        )}
        style={{ "--rail-w": `${width}px` } as CSSProperties}
      >
        <a
          href="#main-content"
          className={cn(
            "sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-mark focus:bg-card focus:px-3 focus:py-2 focus:text-foreground",
            ring,
          )}
        >
          Skip to content
        </a>
        <header className="flex h-(--header-h) shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-3 md:px-4">
          <Link
            href="/"
            className="text-foreground no-underline hover:text-foreground focus-visible:rounded-mark"
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <nav
              aria-label="Learn"
              className="hidden items-center gap-5 text-(length:--text-ui) font-medium md:flex"
            >
              <Link href="/learn" className="text-foreground no-underline hover:underline">
                Learn
              </Link>
              <Link
                href={`/learn/${trackId}`}
                className="text-foreground no-underline hover:underline"
              >
                {trackTitle}
              </Link>
              <Link href="/roadmaps" className="text-foreground no-underline hover:underline">
                Roadmaps
              </Link>
            </nav>
            <Link
              href="/learn"
              className={cn(
                "inline-flex min-h-(--hit-min) items-center rounded-mark border border-border-firm bg-background px-3 text-(length:--text-ui) text-muted-foreground no-underline hover:text-foreground md:min-h-(--control-h-md)",
                ring,
              )}
            >
              Search
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside
            ref={railRef}
            aria-label="Track outline"
            data-testid="outline-rail"
            className={cn(
              "relative min-h-0 w-full shrink-0 overflow-hidden border-r border-border bg-card md:block md:w-(--rail-w)",
              pane === "outline" ? "block" : "hidden",
            )}
          >
            <div className="h-full overflow-y-auto px-1">
              <OutlineList
                groups={groups}
                currentId={currentId}
                onNavigate={() => setPane("content")}
              />
            </div>
            {!isMobile ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize outline"
                aria-valuenow={width}
                aria-valuemin={bounds.min}
                aria-valuemax={bounds.max}
                aria-valuetext={`Outline width ${width} pixels`}
                tabIndex={0}
                data-testid="rail-handle"
                onKeyDown={onKey}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => commit({ type: "max" })}
                className={cn(
                  "absolute inset-y-0 right-0 w-3 cursor-col-resize touch-none after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:bg-border-firm hover:after:bg-route",
                  dragging && "after:bg-route",
                  ring,
                )}
              />
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <main
              id="main-content"
              tabIndex={-1}
              className={cn(
                "min-w-0 focus:outline-none lg:flex-1 lg:overflow-y-auto",
                pane === "content" ? "block" : "hidden md:block",
              )}
            >
              {children}
            </main>
            <aside
              aria-label="Next up and inspector"
              data-testid="right-rail"
              data-collapsed={rightCollapsed}
              className={cn(
                "shrink-0 border-t border-border bg-card lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l",
                rightCollapsed ? "lg:w-12" : "lg:w-(--rail-right-w)",
                pane === "next" ? "block" : "hidden md:block",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <h2
                  className={cn(
                    "font-display text-sm font-semibold",
                    rightCollapsed && "lg:sr-only",
                  )}
                >
                  Next up
                </h2>
                <button
                  type="button"
                  aria-expanded={!rightCollapsed}
                  aria-controls="right-rail-body"
                  onClick={toggleRight}
                  className={cn(
                    "hidden min-h-(--hit-min) min-w-(--hit-min) items-center justify-center rounded-mark border border-border-firm bg-background text-(length:--text-ui) hover:bg-muted lg:inline-flex",
                    ring,
                  )}
                >
                  {rightCollapsed ? "Show" : "Hide"}
                  <span className="sr-only"> next up panel</span>
                </button>
              </div>
              <div id="right-rail-body" className={cn("px-3 pb-3", rightCollapsed && "lg:hidden")}>
                <div data-shell-slot="onpage" ref={setOnPageEl} className="mb-3 empty:hidden" />
                {next.length > 0 ? (
                  <ul className="flex flex-col">
                    {next.map((i) => (
                      <li key={i.id}>
                        <Link
                          href={i.href}
                          onClick={() => setPane("content")}
                          className={cn(
                            "flex min-h-(--hit-min) items-center rounded-mark px-2 text-(length:--text-ui) text-foreground no-underline hover:bg-muted lg:min-h-8",
                            ring,
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate" title={i.title}>
                            {i.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-(length:--text-small) text-muted-foreground">
                    You have reached the end of this track.
                  </p>
                )}
                {/* T-080: in-page heading outline and the T-043 sim inspector render here via portals. */}
                <div
                  data-shell-slot="inspector"
                  ref={setInspectorEl}
                  className="mt-3 empty:hidden"
                />
              </div>
            </aside>
          </div>
        </div>

        <nav
          aria-label="Sections"
          className="flex shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {navItems.map((n) => (
            <button
              key={n.pane}
              type="button"
              aria-pressed={pane === n.pane}
              onClick={() => setPane(n.pane)}
              className={cn(
                "min-h-(--bottom-nav-h) flex-1 text-(length:--text-ui) font-medium text-foreground",
                "aria-pressed:bg-muted aria-pressed:font-semibold aria-pressed:underline",
                ring,
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </ShellSlotsContext.Provider>
  );
}
