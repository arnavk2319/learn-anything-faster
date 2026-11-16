import Link from "next/link";
import { roadmapHref, type PopularMove } from "@/lib/landing-preview";
import { cardMeta, cardTag, type CardSummary } from "./popular-card";

export type PopularCard = PopularMove & { summary?: CardSummary | null };

// Decorative mini route: four stops joined by a line. Tokens only, no animation.
function MiniRoute() {
  return (
    <span aria-hidden="true" className="my-3 flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="flex items-center gap-1 last:flex-none [&:not(:last-child)]:flex-1"
        >
          <span
            className={`size-2.5 shrink-0 rounded-pill border-2 border-route ${i === 0 ? "bg-route" : "bg-card"}`}
          />
          {i < 3 ? <span className="flex-1 border-t-2 border-dashed border-edge" /> : null}
        </span>
      ))}
    </span>
  );
}

// Presentational: moves come from the live catalog. States: cards, empty.
export function PopularMoves({ moves }: { moves: PopularCard[] }) {
  return (
    <section aria-labelledby="popular-moves" className="mt-auto flex flex-col gap-4 border-t pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="popular-moves" className="text-[17px] leading-[1.3] font-semibold">
          Popular moves
        </h2>
        <Link href="/roadmaps" className="text-[15px]">
          <span className="sr-only">Browse </span>All roadmaps
        </Link>
      </div>
      {moves.length === 0 ? (
        <p data-testid="popular-empty" className="text-[15px] text-muted-foreground">
          Moves will appear here once roadmaps are live.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {moves.map((m) => {
            const meta = cardMeta(m.status, m.summary ?? null);
            return (
              <li key={`${m.from}:${m.to}`}>
                <Link
                  href={roadmapHref(m.from, m.to)}
                  data-testid="popular-card"
                  className="block min-h-11 rounded-lg border bg-card p-4 text-foreground no-underline hover:border-route hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    className={
                      m.status === "live"
                        ? "block text-sm font-medium text-route"
                        : "block text-sm text-muted-foreground"
                    }
                  >
                    {cardTag(m.status)}
                  </span>
                  <span className="mt-2 block font-display text-base font-semibold">
                    {m.fromName} to {m.toName}
                  </span>
                  <MiniRoute />
                  <span className="block text-sm text-muted-foreground">{meta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
