import { redirect } from "next/navigation";
import { defaultPair, loadRoles } from "../../lib/roadmap/roles";

export const dynamic = "force-dynamic";

// /roadmap -> the launch move (or ?from=&to= if given), so the graph is the default view (D2).
export default async function RoadmapIndex({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const d = defaultPair(await loadRoles());
  redirect(`/roadmap/${sp.from ?? d.from}/${sp.to ?? d.to}`);
}
