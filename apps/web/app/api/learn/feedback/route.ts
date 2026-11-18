import * as Sentry from "@sentry/nextjs";
import { clientIp } from "../../../../lib/forms/client-ip";
import { createDbLimiter } from "../../../../lib/forms/rate-limit-db";
import {
  FEEDBACK_LIMIT,
  FEEDBACK_WINDOW_MS,
  handleFeedback,
  type FeedbackDb,
} from "../../../../lib/learn/feedback/handler";
import { feedbackTargetExists } from "../../../../lib/learn/feedback/targets";
import { sharedDb } from "../../../../lib/roadmap/db";

export const dynamic = "force-dynamic";

const db = async () => (await sharedDb()) as unknown as FeedbackDb;

// Tags and an error class only: never the request, body, note, client id, IP or target ids (ADR-0017 section 9).
const report = (stage: "parse" | "limit" | "write", cls: string) => {
  Sentry.captureException(new Error(`learn-feedback ${cls}`), {
    tags: { route: "learn-feedback", stage },
  });
};

export async function POST(req: Request): Promise<Response> {
  try {
    return await handleFeedback(req, {
      db,
      limiter: async (key) => {
        const onError = () =>
          Sentry.captureException(new Error("learn-feedback limiter store error"), {
            tags: { rate_limiter: "store_error", route: "learn-feedback", stage: "limit" },
          });
        try {
          return await createDbLimiter(await db(), FEEDBACK_LIMIT, FEEDBACK_WINDOW_MS, { onError })(
            key,
          );
        } catch {
          onError(); // fail open, as ADR-0014
          return true;
        }
      },
      targetExists: feedbackTargetExists,
      clientIp,
      report,
      windowMs: FEEDBACK_WINDOW_MS,
    });
  } catch (e) {
    report("write", e instanceof Error ? e.name : "UnknownError");
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
