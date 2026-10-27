import { sharedDb } from "../../../lib/roadmap/db";
import { handleRoadmap } from "../../../lib/roadmap/http";

export const dynamic = "force-dynamic"; // computation stays dynamic; caching is by header at the edge

export function GET(req: Request) {
  return handleRoadmap(req, sharedDb);
}
