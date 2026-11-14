import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemPage } from "@/components/learn/ItemPage";
import { listApprovedIds, loadTrack } from "@/lib/learn/content";
import { getSiteUrl } from "@/lib/site";

// Only approved items are built; anything else (proposed, unknown, malformed id) is a 404.
export const dynamicParams = false;

type Params = { track: string; concept: string };

export function generateStaticParams(): Params[] {
  return listApprovedIds()
    .filter((e) => e.kind === "concepts")
    .map((e) => ({ track: e.track, concept: e.id }));
}

function find(p: Params) {
  const pack = loadTrack(p.track);
  const item = pack?.concepts.find((c) => c.id === p.concept);
  return pack && item ? { pack, item } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const found = find(p);
  if (!found) return {};
  return {
    title: found.item.title,
    description: found.item.summary,
    alternates: { canonical: `${getSiteUrl()}/learn/${p.track}/concepts/${p.concept}` },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const found = find(await params);
  if (!found) notFound();
  return <ItemPage pack={found.pack} kind="concept" item={found.item} />;
}
