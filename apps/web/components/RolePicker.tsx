"use client";
// Role sentence with two native selects (keyboard operable by default). Presentational: data comes from the page.
import Link from "next/link";
import { useState } from "react";
import type { LandingData } from "../lib/roadmap/landing";
import { TransitionRequestForm } from "./forms/TransitionRequestForm";

const selectClass =
  "bg-highlight text-highlight-foreground rounded-md border border-transparent px-3 py-2 font-display text-xl font-semibold hover:border-b-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function RolePicker({ roles, curated }: LandingData) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const chosen = from !== "" && to !== "";
  const same = chosen && from === to;
  const isCurated = curated.some((p) => p.from === from && p.to === to);
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  if (roles.length === 0) {
    return <p className="text-muted-foreground">No roadmaps are live yet. Check back soon.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap items-center gap-3 font-display text-xl">
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
          <Link
            href={`/roadmap?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
            className="inline-block rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Show my roadmap
          </Link>
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
    </div>
  );
}
