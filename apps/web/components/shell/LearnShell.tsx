"use client";
// Learn app shell (ADR-0016 section 4 and 8): 48px header over a left outline rail, fluid main and a right rail.
// Owns layout and rail state only; pages own data. Under 768px it is one pane with a bottom nav.
// SSR-safe: the server and hydration render use a character-count estimate and empty progress; stored
// width, collapse state and progress are read in effects. Column width animates over --dur-base only for the
// collapse toggle (motion-safe, never while dragging); reduced motion has no transitions.
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { BottomNav } from "@/components/shell/BottomNav";
import { RailToggle } from "@/components/shell/RailToggle";
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
  readExtraPrefs,
  readUiPrefs,
  widthFromFraction,
  writeUiPrefs,
  type RailAction,
  type RailMetrics,
} from "@/lib/shell/rail";
import { ShellSlotsContext, type ShellSlots } from "@/lib/shell/context";
import { cn } from "@/lib/utils";
import { CelebrationsSwitch, RewardsProvider } from "@/components/rewards/RewardsProvider";

type Pane = "outline" | "content" | "next";

const ring = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";
/** Shared row treatment for outline and right-rail rows: 44px, hover Lane, pressed Lane + 10% Pine, scale .99. */
export const railRow =
  "flex min-h-(--hit-min) items-center gap-3 rounded-mark px-2.5 text-(length:--text-body) text-foreground no-underline hover:bg-muted active:bg-[color-mix(in_srgb,var(--muted),var(--primary)_10%)] motion-safe:transition-transform motion-safe:duration-(--dur-press) motion-safe:active:scale-[0.99]";

/** Server and first-paint guess: average glyph width at the 13px compact UI size plus fixed chrome. */
function estimateMetrics(groups: OutlineGroup[]): RailMetrics {
  const longest = Math.max(0, ...groups.flatMap((g) => g.items.map((i) => i.title.length)));
  return { label: Math.ceil(longest * 7.5), chrome: 72 };
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
          "relative size-3.5 shrink-0 overflow-hidden rounded-pill border-[1.5px]",
          state === "done" && "border-route bg-route",
          state === "seen" && "border-route bg-card",
          state === "none" && "border-input bg-card",
        )}
      >
        {state === "seen" ? <span className="absolute inset-y-0 left-0 w-1/2 bg-route" /> : null}
      </span>
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
    <nav aria-label="Outline" className="flex [scrollbar-gutter:stable] flex-col pb-3">
      {groups.map((g) => (
        <div key={g.key} role="group" aria-labelledby={`outline-${g.key}`}>
          <p
            id={`outline-${g.key}`}
            className="flex items-center justify-between px-2.5 pt-3.5 pb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            {g.label}
            <span className="rounded-pill bg-muted px-2 text-xs font-semibold text-foreground">
              {g.items.length}
            </span>
          </p>
          <ul className="flex flex-col">
            {g.items.map((i) => (
              <li key={i.id}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={i.id === currentId ? "page" : undefined}
                  className={cn(
                    railRow,
                    "aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:shadow-[inset_3px_0_0_var(--route)]",
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
  /** Omitted on /learn (no track): the rail lists tracks and the track link is left out of the header. */
  trackId?: string;
  trackTitle?: string;
  groups: OutlineGroup[];
  currentId: string;
  next: OutlineItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [pane, setPane] = useState<Pane>("content");
  const [measured, setMeasured] = useState<RailMetrics | null>(null);
  const [fraction, setFraction] = useState(DEFAULT_FRACTION);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Width animates only after a collapse toggle, never on the first paint or when the measured width settles.
  const [animate, setAnimate] = useState(false);
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
    setLeftCollapsed(readExtraPrefs(window.localStorage).leftCollapsed);
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
    setAnimate(true);
    setRightCollapsed(v);
    writeUiPrefs({ rightCollapsed: v }, window.localStorage);
  };

  const toggleLeft = () => {
    const v = !leftCollapsed;
    setAnimate(true);
    setLeftCollapsed(v);
    writeUiPrefs({ leftCollapsed: v }, window.localStorage);
  };

  const navItems: { pane: Pane; label: string }[] = [
    { pane: "outline", label: "Outline" },
    { pane: "content", label: "Content" },
    { pane: "next", label: "Next" },
  ];

  return (
    <RewardsProvider>
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
                <Link
                  href="/learn"
                  aria-current={pathname === "/learn" ? "page" : undefined}
                  className="text-foreground no-underline hover:underline"
                >
                  Learn
                </Link>
                {trackId ? (
                  <Link
                    href={`/learn/${trackId}`}
                    className="text-foreground no-underline hover:underline"
                  >
                    {trackTitle}
                  </Link>
                ) : null}
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

          <div className="flex min-h-0 flex-1 bg-card">
            <aside
              ref={railRef}
              aria-label={trackId ? "Track outline" : "Tracks"}
              data-testid="outline-rail"
              data-collapsed={leftCollapsed}
              className={cn(
                "relative min-h-0 w-full shrink-0 flex-col border-r border-border bg-card md:w-(--rail-w)",
                leftCollapsed && "md:w-(--rail-collapsed-w)",
                animate &&
                  !dragging &&
                  "motion-safe:md:transition-[width] motion-safe:md:duration-(--dur-base) motion-safe:md:ease-trail",
                pane === "outline" ? "flex" : "hidden md:flex",
              )}
            >
              <div className="hidden h-12 shrink-0 items-center gap-1 overflow-hidden border-b border-border px-0.5 md:flex">
                <RailToggle
                  side="left"
                  expanded={!leftCollapsed}
                  controls="left-rail-body"
                  onToggle={toggleLeft}
                />
                <p
                  className={cn(
                    "min-w-0 truncate font-display text-sm font-semibold",
                    leftCollapsed && "hidden",
                  )}
                >
                  {trackId ? trackTitle : "Tracks"}
                </p>
              </div>
              <div
                id="left-rail-body"
                className={cn(
                  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1",
                  leftCollapsed && "md:hidden",
                )}
              >
                <OutlineList
                  groups={groups}
                  currentId={currentId}
                  onNavigate={() => setPane("content")}
                />
              </div>
              {!isMobile && !leftCollapsed ? (
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
                  "shrink-0 border-t border-border bg-card lg:flex lg:min-h-0 lg:flex-col lg:border-t-0 lg:border-l",
                  rightCollapsed ? "lg:w-(--rail-collapsed-w)" : "lg:w-(--rail-right-w)",
                  animate &&
                    "motion-safe:lg:transition-[width] motion-safe:lg:duration-(--dur-base) motion-safe:lg:ease-trail",
                  pane === "next" ? "block" : "hidden md:block",
                )}
              >
                <div
                  className={cn(
                    "flex h-12 shrink-0 items-center justify-between gap-2 overflow-hidden px-3 lg:border-b lg:border-border lg:py-0 lg:pr-0.5 lg:pl-3",
                    rightCollapsed && "lg:justify-center lg:px-0",
                  )}
                >
                  <h2
                    className={cn(
                      "font-display text-sm font-semibold",
                      rightCollapsed && "lg:sr-only",
                    )}
                  >
                    Next up
                  </h2>
                  <RailToggle
                    side="right"
                    expanded={!rightCollapsed}
                    controls="right-rail-body"
                    onToggle={toggleRight}
                    className="hidden lg:inline-flex"
                  />
                </div>
                <div
                  id="right-rail-body"
                  className={cn(
                    "px-3 pb-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
                    rightCollapsed && "lg:hidden",
                  )}
                >
                  <div data-shell-slot="onpage" ref={setOnPageEl} className="mb-3 empty:hidden" />
                  {next.length > 0 ? (
                    <ul className="flex flex-col">
                      {next.map((i) => (
                        <li key={i.id}>
                          <Link
                            href={i.href}
                            onClick={() => setPane("content")}
                            className={cn(railRow, ring)}
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
                      {trackId
                        ? "You have reached the end of this track."
                        : "Pick a track to start learning."}
                    </p>
                  )}
                  {/* T-080: in-page heading outline and the T-043 sim inspector render here via portals. */}
                  <div
                    data-shell-slot="inspector"
                    ref={setInspectorEl}
                    className="mt-3 empty:hidden"
                  />
                  <CelebrationsSwitch />
                </div>
              </aside>
            </div>
          </div>

          <BottomNav
            label="Sections"
            items={navItems.map((n) => ({
              id: n.pane,
              label: n.label,
              pressed: pane === n.pane,
              onSelect: () => setPane(n.pane),
            }))}
          />
        </div>
      </ShellSlotsContext.Provider>
    </RewardsProvider>
  );
}
