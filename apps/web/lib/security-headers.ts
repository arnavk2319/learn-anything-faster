// Security headers applied to every route from next.config.ts.
//
// CSP choice (T-025): script-src uses 'unsafe-inline', not nonces. Next.js App Router emits inline bootstrap
// scripts; nonces need a proxy that stamps every request and forces dynamic rendering, plus nonce plumbing for
// Sentry/React Flow. 'unsafe-inline' is the least permissive policy that works without that: scripts are still
// limited to our own origin (no remote script hosts), with no object/embed, no framing, and form posts and base
// URI pinned to self. 'unsafe-eval' is added only in development (React/Turbopack need it there).
// style-src needs 'unsafe-inline' because React Flow positions nodes with inline style attributes.
// Follow-up: move to nonces (most routes are already dynamic).

const SENTRY_WILDCARDS = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
];

function dsnOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function buildCsp(env: { dev: boolean; sentryDsns?: (string | undefined)[] }): string {
  const sentry = [
    ...new Set([
      ...SENTRY_WILDCARDS,
      ...(env.sentryDsns ?? []).map(dsnOrigin).filter((x): x is string => x !== null),
    ]),
  ];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(env.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...sentry, ...(env.dev ? ["ws:", "wss:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

export function securityHeaders(env: { dev: boolean; sentryDsns?: (string | undefined)[] }) {
  return [
    { key: "Content-Security-Policy", value: buildCsp(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
