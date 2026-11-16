import { PopularMoves } from "@/components/landing/PopularMoves";
import { RolePicker } from "@/components/RolePicker";
import { pickPopular } from "@/lib/landing-preview";
import { getCatalog } from "@/lib/roadmap/catalog";
import { sharedDb } from "@/lib/roadmap/db";
import { getLandingData } from "@/lib/roadmap/landing";
import { getRoadmap } from "@/lib/roadmap/service";
import { cardSummary } from "@/components/landing/popular-card";

export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", images: ["/opengraph-image"] },
};
export const dynamic = "force-dynamic"; // roles come from the DB at request time

export default async function HomePage() {
  const db = await sharedDb();
  const [data, catalog] = await Promise.all([getLandingData(db), getCatalog(db)]);
  // Hours for Live cards come from the same roadmap query and summarizeRoadmap the roadmap page uses.
  const moves = await Promise.all(
    pickPopular(catalog).map(async (m) => {
      if (m.status !== "live") return { ...m, summary: null };
      const r = await getRoadmap(db, m.from, m.to);
      return { ...m, summary: r ? cardSummary(r.nodes, r.covered.length) : null };
    }),
  );
  return (
    <main className="flex flex-1 flex-col px-4 pt-8 pb-10 md:px-16 md:pt-14">
      <h1 className="text-[28px] leading-[1.15] font-bold md:text-[34px]">
        Learn only what you still need
      </h1>
      <p className="mt-2 mb-6 text-muted-foreground md:mb-8">
        Pick two roles. We show only the topics you still need, in the order that makes sense.
      </p>
      <RolePicker {...data} />
      <PopularMoves moves={moves} />
    </main>
  );
}
