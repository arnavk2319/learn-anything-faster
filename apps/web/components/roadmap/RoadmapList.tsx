"use client";
// Accessible nested list view (F10): the same roadmap as the graph, as areas containing topics in
// route order. Presentational; selecting a topic uses the shared selection store so the TopicPanel
// opens exactly as it does from the graph.
import { cn } from "../../lib/utils";
import { focusRing, lift } from "../ui/tactile";
import type { ListArea } from "../../lib/roadmap/list-model";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";

export function RoadmapList({ areas, startId }: { areas: ListArea[]; startId: string | null }) {
  const selected = useSelectedTopicId();
  return (
    <nav aria-label="Roadmap topics" data-testid="roadmap-list" className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {areas.map((a) => (
          <li key={a.key} className="rounded-lane bg-lane p-4">
            <h2
              className={cn(
                "font-display text-(length:--text-body) font-semibold",
                a.covered ? "text-route" : "text-foreground",
              )}
            >
              {a.label}{" "}
              <span className="text-(length:--text-ui) font-normal text-muted-foreground">
                ({a.topics.length} {a.topics.length === 1 ? "topic" : "topics"})
              </span>
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {a.topics.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={selected === t.id}
                    aria-label={
                      t.covered
                        ? `${t.name}, you already know this${
                            t.needs.length > 0 ? `. Learn these first: ${t.needs.join(", ")}` : ""
                          }`
                        : undefined
                    }
                    data-topic-id={t.id}
                    onClick={() => selectTopic(t.id)}
                    className={cn(
                      "flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-md border-[1.5px] px-3 py-1.5 text-left text-(length:--text-ui) shadow-1 hover:border-primary",
                      focusRing,
                      lift,
                      t.covered
                        ? "border-route bg-known text-known-foreground"
                        : "border-dashed border-input bg-card text-foreground",
                      selected === t.id &&
                        "border-solid border-primary bg-highlight text-highlight-foreground",
                    )}
                  >
                    <span className="font-medium">
                      {t.name}
                      {t.id === startId && (
                        <span className="ml-2 rounded-sm border border-primary px-1 text-(length:--text-small) font-semibold">
                          Start here
                        </span>
                      )}
                    </span>
                    {t.needs.length > 0 && (
                      <span
                        className={cn(
                          "text-(length:--text-small)",
                          selected === t.id ? "text-highlight-foreground" : "text-muted-foreground",
                        )}
                      >
                        Learn these first: {t.needs.join(", ")}
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
