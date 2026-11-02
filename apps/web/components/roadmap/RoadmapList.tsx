"use client";
// Accessible nested list view (F10): the same roadmap as the graph, as areas containing topics in
// route order. Presentational; selecting a topic uses the shared selection store so the TopicPanel
// opens exactly as it does from the graph.
import { cn } from "../../lib/utils";
import type { ListArea } from "../../lib/roadmap/list-model";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";

export function RoadmapList({ areas }: { areas: ListArea[] }) {
  const selected = useSelectedTopicId();
  return (
    <nav aria-label="Roadmap topics" data-testid="roadmap-list" className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {areas.map((a) => (
          <li key={a.key} className="rounded-lane bg-lane p-4">
            <h2
              className={cn(
                "font-display text-base font-semibold",
                a.covered ? "text-route" : "text-foreground",
              )}
            >
              {a.label}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({a.topics.length} {a.topics.length === 1 ? "topic" : "topics"})
              </span>
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {a.topics.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={selected === t.id}
                    aria-label={t.covered ? `${t.name}, you already know this` : undefined}
                    data-topic-id={t.id}
                    onClick={() => selectTopic(t.id)}
                    className={cn(
                      "flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left text-sm transition-colors duration-[var(--dur-fast)] hover:border-primary",
                      t.covered
                        ? "border-route bg-known text-known-foreground"
                        : "border-[color:var(--bark)] bg-card text-foreground",
                      selected === t.id &&
                        "border-[1.5px] border-primary bg-highlight text-highlight-foreground",
                    )}
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.needs.length > 0 && (
                      <span className="text-[13px] text-muted-foreground">
                        Needs first: {t.needs.join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </nav>
  );
}
