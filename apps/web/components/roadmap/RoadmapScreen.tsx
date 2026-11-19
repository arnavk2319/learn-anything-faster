"use client";
// Feature container for /roadmap/[from]/[to]: owns the query, the layout pipeline and the view state.
// Presentational children: RoadmapCanvas, CanvasStates. Role changes navigate (soft, no reload);
// the query key ["roadmap", from, to] does the rest.
import { suggestStart } from "@laf/graph";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fetchRoadmap, isUnmapped, roadmapKey } from "../../lib/roadmap/client";
import { buildModel, metricsFor, toElk, toFlow, type FlowGraph } from "../../lib/roadmap/layout";
import { layoutInWorker } from "../../lib/roadmap/layout-client";
import { buildListModel } from "../../lib/roadmap/list-model";
import type { RoleOption } from "../../lib/roadmap/roles";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/button";
import { focusRing } from "../ui/tactile";
import { summarizeRoadmap } from "../../lib/roadmap/summary";
import { EmptyState, ErrorState, LoadingState, UnmappedState } from "./CanvasStates";
import { RoadmapCanvas } from "./RoadmapCanvas";
import { RoadmapList } from "./RoadmapList";
import { ShareLink } from "./ShareLink";
import { TopicPanel } from "./TopicPanel";
import { ViewToggle, type View } from "./ViewToggle";

// This screen opts into the compact tier in app/roadmap/layout.tsx (data-density="compact").
const METRICS = metricsFor("compact");

const selectCls = `font-display min-h-11 cursor-pointer appearance-none bg-transparent text-xl font-semibold tracking-tight md:text-2xl ${focusRing}`;

// Below Tailwind's sm breakpoint the list is the default view (F10). SSR snapshot is false.
const SMALL = "(max-width: 639px)";
const subscribeSmall = (cb: () => void) => {
  const m = window.matchMedia(SMALL);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useSmallScreen = () =>
  useSyncExternalStore(
    subscribeSmall,
    () => window.matchMedia(SMALL).matches,
    () => false,
  );

function RoleSelect({
  label,
  value,
  roles,
  onChange,
  highlight,
}: {
  label: string;
  value: string;
  roles: RoleOption[];
  onChange: (id: string) => void;
  highlight?: boolean;
}) {
  const known = roles.some((r) => r.id === value);
  // One Blaze element per screen (T-087): while a topic is selected the selection owns it.
  const nothingSelected = useSelectedTopicId() === null;
  const blaze = highlight && nothingSelected;
  return (
    <span
      className={
        blaze
          ? "inline-flex items-baseline gap-1 rounded-sm bg-highlight px-2 text-highlight-foreground"
          : "inline-flex items-baseline gap-1 border-b-[3px] border-primary"
      }
    >
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {!known && <option value={value}>{value}</option>}
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.status === "live" ? r.name : `${r.name} (coming soon)`}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-base">
        ▾
      </span>
    </span>
  );
}

export function RoadmapScreen({
  from,
  to,
  roles,
}: {
  from: string;
  to: string;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const q = useQuery({
    queryKey: roadmapKey(from, to),
    queryFn: ({ signal }) => fetchRoadmap(from, to, signal),
    retry: (n, e) => !isUnmapped(e) && n < 1,
    staleTime: 60_000,
  });
  const data = q.data;

  // View choice lives in the URL (?view=list|graph) so it survives reload and share links.
  const params = useSearchParams();
  const param = params.get("view");
  const small = useSmallScreen();
  const setView = (v: View) => {
    const next = new URLSearchParams(window.location.search);
    next.set("view", v);
    window.history.replaceState(null, "", `?${next.toString()}`);
  };

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [showCovered, setShowCovered] = useState(false);
  const toggleArea = useCallback(
    (key: string) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [],
  );

  const model = useMemo(
    () => (data ? buildModel(data, { collapsed, showCovered }) : null),
    [data, collapsed, showCovered],
  );

  // Layout runs in the worker. `laid` remembers which roadmap it belongs to so a role change
  // shows the loading state rather than the previous move's graph; collapse keeps the old graph
  // on screen until the new positions arrive.
  const [laid, setLaid] = useState<{ key: string; graph: FlowGraph } | null>(null);
  const [layoutFailed, setLayoutFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = `${from}>${to}`;
  useEffect(() => {
    if (!model) return;
    let live = true;
    layoutInWorker(toElk(model, METRICS)).then(
      (res) => {
        if (live) {
          setLayoutFailed(false);
          setLaid({ key, graph: toFlow(model, res, METRICS) });
        }
      },
      () => live && setLayoutFailed(true),
    );
    return () => {
      live = false;
    };
  }, [model, key, attempt]);

  // A selection that is not on this roadmap makes no sense after a role change.
  useEffect(() => {
    selectTopic(null);
  }, [key]);

  const wanted: View = param === "list" || param === "graph" ? param : small ? "list" : "graph";
  const view: View = wanted === "graph" && layoutFailed ? "list" : wanted;
  const listAreas = useMemo(
    () => (data ? buildListModel(data, { showCovered }) : []),
    [data, showCovered],
  );

  const startId = useMemo(
    () =>
      data
        ? suggestStart(
            data.nodes,
            data.edges,
            data.covered.map((c) => c.id),
          )
        : null,
    [data],
  );
  const startName = data?.nodes.find((n) => n.id === startId)?.name;
  const startHere = () => {
    if (!startId) return;
    selectTopic(startId);
    // Already selected: the panel will not re-open, so move focus into it explicitly.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[data-testid="topic-panel"]')?.focus(),
    );
  };

  const go = (f: string, t: string) => router.replace(`/roadmap/${f}/${t}`);
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  // Loading: reserve the control strip's Start and view-toggle slots so the canvas does not move (T-062).
  const pending = !data && !q.isError;
  let body;
  if (q.isError && isUnmapped(q.error)) {
    body = <UnmappedState fromId={from} toId={to} fromName={name(from)} toName={name(to)} />;
  } else if (q.isError || (layoutFailed && !data)) {
    body = (
      <ErrorState
        onRetry={() => {
          setLayoutFailed(false);
          void q.refetch();
        }}
      />
    );
  } else if (data && data.nodes.length === 0 && !showCovered) {
    body = <EmptyState />;
  } else if (view === "list" && data) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 md:px-6">
        {wanted === "graph" && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
            <span>The graph couldn&apos;t be drawn, so here is the list.</span>
            <button
              type="button"
              onClick={() => {
                setLayoutFailed(false);
                setAttempt((n) => n + 1);
              }}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Try the graph again
            </button>
          </div>
        )}
        {data.covered.length > 0 && (
          <button
            type="button"
            aria-pressed={showCovered}
            onClick={() => setShowCovered((v) => !v)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "w-fit",
              showCovered && "border-route bg-known text-route",
            )}
          >
            {showCovered
              ? "Hide what you know"
              : `Show what you already know (${data.covered.length})`}
          </button>
        )}
        <RoadmapList areas={listAreas} startId={startId} />
      </div>
    );
  } else if (laid && laid.key === key && data) {
    body = (
      <RoadmapCanvas
        key={key}
        graph={laid.graph}
        startId={startId}
        onToggleArea={toggleArea}
        coveredCount={data.covered.length}
        showCovered={showCovered}
        onToggleCovered={() => setShowCovered((v) => !v)}
      />
    );
  } else {
    body = <LoadingState />;
  }

  const meta = data
    ? (summarizeRoadmap({ topics: data.nodes, coveredCount: data.covered.length }).sentence ?? " ")
    : q.isError && isUnmapped(q.error)
      ? "Nothing curated for this move yet."
      : " ";

  return (
    <div className="flex min-h-0 flex-1">
      <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2 md:px-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {/* Fixed 20/24px (existing e2e): the important modifiers beat the compact tier h1 rule. */}
            <h1 className="flex flex-wrap items-baseline gap-3 text-xl! font-semibold tracking-tight md:text-2xl!">
              <RoleSelect
                label="Current role"
                value={from}
                roles={roles}
                onChange={(id) => go(id, to)}
              />
              <span className="font-normal text-muted-foreground">to</span>
              <RoleSelect
                label="Target role"
                value={to}
                roles={roles}
                onChange={(id) => go(from, id)}
                highlight
              />
            </h1>
            {pending ? (
              <div
                aria-hidden="true"
                className="h-5 w-full max-w-96 rounded-md bg-lane motion-safe:animate-pulse"
              />
            ) : (
              <p className="text-(length:--text-ui) text-muted-foreground">{meta}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pending && (
              <div
                aria-hidden="true"
                data-testid="strip-skeleton"
                className="h-11 w-36 rounded-md bg-lane motion-safe:animate-pulse"
              />
            )}
            {startName && (
              <button
                type="button"
                onClick={startHere}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "md" }),
                  "min-h-11 w-fit",
                )}
              >
                Start with {startName}
              </button>
            )}
            <ShareLink from={from} to={to} />
            {pending && (
              <div
                aria-hidden="true"
                className="h-8.5 w-32 rounded-md bg-lane motion-safe:animate-pulse"
              />
            )}
            {data && data.nodes.length > 0 && <ViewToggle view={view} onChange={setView} />}
          </div>
        </div>
        {body}
      </main>
      <TopicPanel data={data} />
    </div>
  );
}
