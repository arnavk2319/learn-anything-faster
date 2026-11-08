"use client";
// Role sentence with two native selects (keyboard operable by default). Presentational: data comes from the page.
import Link from "next/link";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchRoadmap, isUnmapped, roadmapKey } from "../lib/roadmap/client";
import type { LandingData } from "../lib/roadmap/landing";
import { deriveRouteView } from "../lib/route-view";
import { RouteLine } from "./route/RouteLine";
import { TransitionRequestForm } from "./forms/TransitionRequestForm";

const selectClass =
  "cursor-pointer rounded-md border-b-2 border-transparent bg-highlight px-3 font-display text-highlight-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function RolePicker(props: LandingData) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <RolePickerInner {...props} />
    </QueryClientProvider>
  );
}

function RolePickerInner({ roles, curated }: LandingData) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const chosen = from !== "" && to !== "";
  const same = chosen && from === to;
  const isCurated = curated.some((p) => p.from === from && p.to === to);
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  // The preview is the abstract route until a curated pair is picked; then it shows that pair's
  // API data. The query key ["roadmap", from, to] keeps a stale response from showing for a newer pair.
  const query = useQuery({
    queryKey: roadmapKey(from, to),
    queryFn: ({ signal }) => fetchRoadmap(from, to, signal),
    enabled: chosen && !same && isCurated,
    retry: (n, e) => !isUnmapped(e) && n < 1,
    staleTime: 60_000,
  });
  const view = deriveRouteView({
    chosen,
    same,
    isCurated,
    data: query.data,
    unmappedError: query.isError && isUnmapped(query.error),
  });
  const livePreview = view.kind === "live" ? view.preview : null;

  if (roles.length === 0) {
    return <p className="text-muted-foreground">No roadmaps are live yet. Check back soon.</p>;
  }
  return (
    <div className="flex flex-1 flex-col gap-8">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-2 font-display text-[34px] leading-[1.2] font-semibold tracking-[-1.2px] md:text-[56px] md:leading-[1.18]">
        <label htmlFor="from-role">I am a</label>
        <select
          id="from-role"
          className={selectClass}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          <option value="">Pick your role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <label htmlFor="to-role">and I want to be a</label>
        <select
          id="to-role"
          className={selectClass}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        >
          <option value="">Pick a target role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </p>
      <div aria-live="polite">
        {same ? (
          <p className="text-muted-foreground">Pick two different roles.</p>
        ) : isCurated ? (
          <>
            <Link
              href={`/roadmap?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
              className="inline-flex h-13 items-center rounded-md bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Show my roadmap
            </Link>
            {livePreview ? (
              <span className="ml-5 text-muted-foreground">
                {livePreview.topicCount} topics to learn. {livePreview.knownCount} you already know
                from your current role.
              </span>
            ) : null}
          </>
        ) : chosen ? (
          <div className="flex flex-col gap-3">
            <p>This move isn&apos;t mapped yet.</p>
            <TransitionRequestForm fromRole={from} toRole={to} kind="request" />
            <p className="text-sm text-muted-foreground">
              {name(from)} to {name(to)}
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-8">
        <RouteLine
          preview={livePreview ?? undefined}
          state={view.kind}
          fromName={chosen && !same ? name(from) : undefined}
          toName={chosen && !same ? name(to) : undefined}
        />
      </div>
    </div>
  );
}
