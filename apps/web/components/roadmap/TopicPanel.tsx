"use client";
// Topic panel (DESIGN.md sections 8 and 9): right-hand panel on desktop, bottom sheet below lg.
// Presentational over the cached roadmap response; selection comes from selection-store.
// Escape closes and returns focus to the originating node button.
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import type { RoadmapResource, RoadmapResponse } from "../../lib/roadmap/schema";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";
import { SuggestResourceForm } from "../forms/SuggestResourceForm";

const TYPE_LABEL: Record<RoadmapResource["type"], string> = {
  youtube: "YouTube",
  coursera: "Coursera",
  course: "Course",
  book: "Book",
  docs: "Docs",
  blog: "Blog",
  article: "Article",
};

const isWebUrl = (u: string) => /^https?:\/\//i.test(u);

function Chips({
  label,
  items,
  empty,
}: {
  label: string;
  items: { id: string; name: string }[];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-sm text-muted-foreground">{empty}</span>}
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectTopic(c.id)}
            className="h-[30px] cursor-pointer rounded-pill border border-[color:var(--bark)] bg-card px-3 text-sm hover:border-primary"
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TopicPanel({ data }: { data: RoadmapResponse | undefined }) {
  const id = useSelectedTopicId();
  const ref = useRef<HTMLElement>(null);
  const node = id ? data?.nodes.find((n) => n.id === id) : undefined;
  const coveredTopic = id && !node ? data?.covered.find((c) => c.id === id) : undefined;
  const open = Boolean(node ?? coveredTopic);
  const wasOpen = useRef(false);

  // Move focus into the panel when it opens; return it to the node when it closes.
  useEffect(() => {
    if (open && !wasOpen.current) ref.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const current = id;
      selectTopic(null);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`button[data-topic-id="${current}"]`)?.focus(),
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, id]);

  if (!data || !open || !id) return null;
  const name = node?.name ?? coveredTopic!.name;
  const area = node?.area ?? coveredTopic!.area;
  const nameOf = (tid: string) =>
    data.nodes.find((n) => n.id === tid) ?? data.covered.find((c) => c.id === tid);
  const pick = (tid: string) => {
    const t = nameOf(tid);
    return t ? [{ id: t.id, name: t.name }] : [];
  };
  const needs = data.edges.filter((e) => e.topicId === id).flatMap((e) => pick(e.prerequisiteId));
  const unlocks = data.edges.filter((e) => e.prerequisiteId === id).flatMap((e) => pick(e.topicId));

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="complementary"
      aria-label={`Topic: ${name}`}
      data-testid="topic-panel"
      className={cn(
        "fixed z-20 flex flex-col gap-3.5 overflow-y-auto bg-card p-6 outline-none",
        "inset-x-0 bottom-0 max-h-[70vh] rounded-t-lg border-t border-border shadow-md",
        "lg:inset-x-auto lg:top-24 lg:right-6 lg:bottom-6 lg:max-h-none lg:w-[400px] lg:rounded-lg lg:border lg:shadow-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">{area}</span>
          <h2 className="font-display text-[28px] leading-[1.15] font-semibold tracking-tight">
            {name}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => {
            const current = id;
            selectTopic(null);
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>(`button[data-topic-id="${current}"]`)?.focus(),
            );
          }}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-pill border border-border text-sm hover:border-primary"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {node ? (
        <>
          <p className="text-[15px] leading-relaxed">{node.why}</p>
          <p className="text-sm text-muted-foreground">About {node.estHours} hours.</p>
        </>
      ) : (
        <p className="text-sm font-medium text-known-foreground">
          You already know this from your current role, so it's not on your route.
        </p>
      )}
      <Chips label="Needs first" items={needs} empty="Nothing, start here" />
      <Chips label="Unlocks" items={unlocks} empty="End of this branch" />
      {node && (
        <section aria-label="Resources" className="flex flex-col border-t border-border">
          {node.resources.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No approved resources yet. Suggest one below.
            </p>
          ) : (
            <ul>
              {node.resources.map((r) => (
                <li key={r.id} className="border-b border-border">
                  {isWebUrl(r.url) ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 py-3 no-underline"
                    >
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">{r.title}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {TYPE_LABEL[r.type]}
                          {" · "}
                          <span
                            className={cn(
                              "rounded-pill px-2 py-px text-xs font-medium",
                              r.isFree
                                ? "bg-known text-known-foreground"
                                : "bg-highlight text-highlight-foreground",
                            )}
                          >
                            {r.isFree ? "Free" : "Paid"}
                          </span>
                        </span>
                      </span>
                      <span aria-hidden="true" className="mt-0.5 text-primary">
                        ↗
                      </span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {node && (
        <details className="mt-auto">
          <summary className="cursor-pointer text-sm text-primary">Suggest a resource</summary>
          <div className="pt-3">
            <SuggestResourceForm key={node.id} topicId={node.id} />
          </div>
        </details>
      )}
    </aside>
  );
}
