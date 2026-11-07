import { PopularMoves } from "@/components/landing/PopularMoves";
import { RolePicker } from "@/components/RolePicker";
import { pickPopular } from "@/lib/landing-preview";
import { getCatalog } from "@/lib/roadmap/catalog";
import { sharedDb } from "@/lib/roadmap/db";
import { getLandingData } from "@/lib/roadmap/landing";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", images: ["/opengraph-image"] },
};
export const dynamic = "force-dynamic"; // roles come from the DB at request time

export default async function HomePage() {
  const db = await sharedDb();
  const [data, catalog] = await Promise.all([getLandingData(db), getCatalog(db)]);
  return (
    <main className="flex flex-1 flex-col px-4 pt-8 pb-10 md:px-16 md:pt-14">
      <h1 className="sr-only">{SITE_NAME}</h1>
      <RolePicker {...data} />
      <PopularMoves moves={pickPopular(catalog)} />
    </main>
  );
}
