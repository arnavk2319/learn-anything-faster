import { RoadmapScreen } from "../../../../components/roadmap/RoadmapScreen";
import { loadRoles } from "../../../../lib/roadmap/roles";

export const dynamic = "force-dynamic"; // reads the role list from the DB

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ from: string; to: string }>;
}) {
  const { from, to } = await params;
  return <RoadmapScreen from={from} to={to} roles={await loadRoles()} />;
}
