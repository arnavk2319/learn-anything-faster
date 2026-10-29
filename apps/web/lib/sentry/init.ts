import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./scrub";

export type SentryKind = "server" | "client";

/**
 * Build init options, or null when no DSN is set (Sentry stays disabled, app unaffected).
 * No tracing, no replay, no tunnel, no source-map upload (ADR-0009).
 */
export function buildSentryOptions(
  dsn: string | undefined,
  kind: SentryKind,
  overrides: Partial<Sentry.NodeOptions> = {},
): Sentry.NodeOptions | null {
  if (!dsn || dsn.trim() === "") return null;
  return {
    dsn,
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    initialScope: { tags: { runtime: kind } },
    beforeSend: (event) => scrubEvent(event),
    ...overrides,
  };
}

/** Initialise Sentry if a DSN is provided. Returns whether it was enabled. */
export function initSentry(
  dsn: string | undefined,
  kind: SentryKind,
  overrides?: Partial<Sentry.NodeOptions>,
): boolean {
  const options = buildSentryOptions(dsn, kind, overrides);
  if (!options) return false;
  Sentry.init(options);
  return true;
}
