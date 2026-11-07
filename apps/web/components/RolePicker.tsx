"use client";
// Role sentence with two native selects (keyboard operable by default). Presentational: data comes from the page.
import Link from "next/link";
import { useState } from "react";
import type { RoutePreview } from "../lib/landing-preview";
import type { LandingData } from "../lib/roadmap/landing";
import { RouteLine } from "./route/RouteLine";
import { TransitionRequestForm } from "./forms/TransitionRequestForm";

const selectClass =
  "cursor-pointer rounded-md border-b-2 border-transparent bg-highlight px-3 font-display text-highlight-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function RolePicker({ roles, curated, preview }: LandingData & { preview: RoutePreview }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const chosen = from !== "" && to !== "";
  const same = chosen && from === to;
  const isCurated = curated.some((p) => p.from === from && p.to === to);
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  const isSeedPair = from === preview.fromId && to === preview.toId;
  // Route preview: seed move by default; muted when the chosen move is unmapped; hidden for other
  // curated moves (no seed data for them, so nothing is invented).
  const routeState =
    !chosen || same ? "live" : isCurated ? (isSeedPair ? "live" : null) : "unmapped";

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
            {isSeedPair ? (
              <span className="ml-5 text-muted-foreground">
                {preview.topicCount} topics to learn. {preview.knownCount} you already know from
                your current role.
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
      {routeState ? (
        <div className="mt-8">
          <RouteLine
            preview={preview}
            state={routeState}
            fromName={chosen && !same ? name(from) : undefined}
            toName={chosen && !same ? name(to) : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
