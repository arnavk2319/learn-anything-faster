// Reports limiter store failures to Sentry, tagged only. Never pass the key, IP or query text along.
import * as Sentry from "@sentry/nextjs";

export const reportLimiterError = (e: unknown): void => {
  Sentry.captureException(e, { tags: { rate_limiter: "store_error" } });
};
