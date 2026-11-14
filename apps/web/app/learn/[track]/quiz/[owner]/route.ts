import { NextResponse } from "next/server";
import { listApprovedIds, loadTrack, ownerQuestions } from "@/lib/learn/content";
import { toGrading } from "@/lib/learn/quickcheck";

// Static grading JSON for the quick check: answers and explanations are fetched client-side, never put in
// the page HTML (ADR-0015 sections 1 and 4). Approved questions only.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { track: string; owner: string }[] {
  return listApprovedIds().map((e) => ({ track: e.track, owner: e.id }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ track: string; owner: string }> },
) {
  const { track, owner } = await params;
  const pack = loadTrack(track);
  if (!pack) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(ownerQuestions(pack, owner).map(toGrading));
}
