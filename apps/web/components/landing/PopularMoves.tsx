import Link from "next/link";
import { roadmapHref, type PopularMove } from "@/lib/landing-preview";

// Presentational: moves come from the live catalog. States: list, empty.
export function PopularMoves({ moves }: { moves: PopularMove[] }) {
  return (
    <section
      aria-labelledby="popular-moves"
      className="mt-auto flex flex-col gap-3 border-t pt-5 text-[15px] md:flex-row md:items-baseline md:gap-12"
    >
      <h2 id="popular-moves" className="text-[17px] leading-[1.3] font-semibold">
        Popular moves
      </h2>
      {moves.length === 0 ? (
        <p data-testid="popular-empty" className="text-muted-foreground">
          Moves will appear here once roadmaps are live.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 md:flex-row md:gap-12">
          {moves.map((m) => (
            <li key={`${m.from}:${m.to}`}>
              <Link
                href={roadmapHref(m.from, m.to)}
                className="text-foreground no-underline hover:text-route-hover hover:underline"
              >
                {m.fromName} to {m.toName}
                <span
                  className={
                    m.status === "live"
                      ? "ml-1.5 font-medium text-route"
                      : "ml-1.5 text-muted-foreground"
                  }
                >
                  {m.status === "live" ? "Live" : "Soon"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/roadmaps" className="md:ml-auto">
        <span className="sr-only">Browse </span>All roadmaps
      </Link>
    </section>
  );
}
