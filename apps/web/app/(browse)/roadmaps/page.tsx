import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { TransitionRequestForm } from "@/components/forms/TransitionRequestForm";
import {
  filterCatalog,
  getCatalog,
  parseCatalogFilter,
  type CatalogFilter,
} from "@/lib/roadmap/catalog";
import { sharedDb } from "@/lib/roadmap/db";

export const dynamic = "force-dynamic"; // roles come from the DB at request time
export const metadata = { title: "Browse roadmaps" };

const FILTERS: { id: CatalogFilter; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/roadmaps" },
  { id: "live", label: "Live", href: "/roadmaps?status=live" },
  { id: "coming-soon", label: "Coming soon", href: "/roadmaps?status=coming-soon" },
];

export default async function RoadmapsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const filter = parseCatalogFilter((await searchParams).status);
  const entries = filterCatalog(await getCatalog(await sharedDb()), filter);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-testid="catalog-scroll"
      className="min-h-0 flex-1 overflow-y-auto outline-none"
    >
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <h1 className="font-display font-bold">Browse roadmaps</h1>
        <nav aria-label="Filter roadmaps" className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.href}
              aria-current={f.id === filter ? "page" : undefined}
              className={cn(
                "hit-area inline-flex h-control-md items-center rounded-pill border border-border-firm px-4 text-[length:var(--text-ui)] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                f.id === filter
                  ? "border-transparent bg-highlight text-highlight-foreground"
                  : "bg-card shadow-1 hover:bg-lane",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {entries.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No roadmaps match this filter.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {entries.map((e) => (
              <li key={`${e.from}:${e.to}`} data-testid="catalog-entry">
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-[length:var(--text-h2)] font-semibold">
                      {e.fromName} to {e.toName}
                    </span>
                    <Chip>{e.status === "live" ? "Live" : "Coming soon"}</Chip>
                  </div>
                  {e.status === "live" ? (
                    <Link
                      href={`/roadmap/${encodeURIComponent(e.from)}/${encodeURIComponent(e.to)}`}
                      className={cn(buttonVariants({ size: "lg" }), "self-start")}
                    >
                      View roadmap
                    </Link>
                  ) : (
                    <TransitionRequestForm
                      fromRole={e.from}
                      toRole={e.to}
                      kind="notify"
                      idSuffix={`${e.from}-${e.to}`}
                      formLabel={`Notify me about ${e.fromName} to ${e.toName}`}
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
