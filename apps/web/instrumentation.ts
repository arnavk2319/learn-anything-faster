import * as Sentry from "@sentry/nextjs";
import { initSentry } from "@/lib/sentry/init";

export function register() {
  initSentry(process.env.SENTRY_DSN, "server");
}

// Captures unhandled errors from server components, route handlers and actions.
export const onRequestError = Sentry.captureRequestError;
