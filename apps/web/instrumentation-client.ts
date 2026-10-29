import { initSentry } from "@/lib/sentry/init";

// NEXT_PUBLIC_ is inlined at build time; with no DSN this is a no-op.
initSentry(process.env.NEXT_PUBLIC_SENTRY_DSN, "client");
