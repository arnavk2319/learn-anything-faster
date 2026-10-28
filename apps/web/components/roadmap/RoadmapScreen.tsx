"use client";
// Feature container for /roadmap/[from]/[to]: owns the query, the layout pipeline and the view state.
// Presentational children: RoadmapCanvas, CanvasStates. Role changes navigate (soft, no reload);
// the query key ["roadmap", from, to] does the rest.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRoadmap, isUnmapped, roadmapKey } from "../../lib/roadmap/client";
import { buildModel, toElk, toFlow, type FlowGraph } from "../../lib/roadmap/layout";
import { layoutInWorker } from "../../lib/roadmap/layout-client";
import type { RoleOption } from "../../lib/roadmap/roles";
import { selectTopic } from "../../lib/roadmap/selection-store";
import { EmptyState, ErrorState, LoadingState, UnmappedState } from "./CanvasStates";
import { RoadmapCanvas } from "./RoadmapCanvas";

const selectCls =
  "font-display cursor-pointer appearance-none bg-transparent text-3xl font-semibold tracking-tight";

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
  return (
    <span
      className={
        highlight
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
  const key = `${from}>${to}`;
  useEffect(() => {
    if (!model) return;
    let live = true;
    layoutInWorker(toElk(model)).then(
      (res) => {
        if (live) {
          setLayoutFailed(false);
          setLaid({ key, graph: toFlow(model, res) });
        }
      },
      () => live && setLayoutFailed(true),
    );
    return () => {
      live = false;
    };
  }, [model, key]);

  // A selection that is not on this roadmap makes no sense after a role change.
  useEffect(() => {
    selectTopic(null);
  }, [key]);

  const go = (f: string, t: string) => router.push(`/roadmap/${f}/${t}`);
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  let body;
  if (q.isError && isUnmapped(q.error)) {
    body = <UnmappedState fromId={from} toId={to} fromName={name(from)} toName={name(to)} />;
  } else if (q.isError || layoutFailed) {
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
  } else if (laid && laid.key === key && data) {
    body = (
      <RoadmapCanvas
        key={key}
        graph={laid.graph}
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
    ? `Built from ${data.nodes.length} topics and ${data.edges.length} prerequisite links. ${data.covered.length} topics skipped because your role covers them.`
    : q.isError && isUnmapped(q.error)
      ? "Nothing curated for this move yet."
      : " ";

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3.5 px-8 pt-1 pb-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight">
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
        <p className="text-sm text-muted-foreground">{meta}</p>
      </div>
      {body}
    </main>
  );
}
