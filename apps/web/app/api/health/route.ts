import { sharedDb } from "../../../lib/roadmap/db";
import { handleHealth } from "../../../lib/roadmap/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handleHealth(sharedDb);
}
