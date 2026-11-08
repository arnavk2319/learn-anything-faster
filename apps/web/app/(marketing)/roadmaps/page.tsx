import Link from "next/link";
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
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">Browse roadmaps</h1>
      <nav aria-label="Filter roadmaps" className="mt-6 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.href}
            aria-current={f.id === filter ? "page" : undefined}
            className={
              f.id === filter
                ? "rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                : "rounded-md border px-4 py-2 hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {entries.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No roadmaps match this filter.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {entries.map((e) => (
            <li
              key={`${e.from}:${e.to}`}
              data-testid="catalog-entry"
              className="flex flex-col gap-3 rounded-md border p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-semibold">
                  {e.fromName} to {e.toName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {e.status === "live" ? "Live" : "Coming soon"}
                </span>
              </div>
              {e.status === "live" ? (
                <Link
                  href={`/roadmap/${encodeURIComponent(e.from)}/${encodeURIComponent(e.to)}`}
                  className="inline-block self-start rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
