// Security headers applied to every route from next.config.ts.
//
// CSP choice (T-025): script-src uses 'unsafe-inline', not nonces. Next.js App Router emits inline bootstrap
// scripts; nonces need a proxy that stamps every request and forces dynamic rendering, plus nonce plumbing for
// Sentry/React Flow. 'unsafe-inline' is the least permissive policy that works without that: scripts are still
// limited to our own origin (no remote script hosts), with no object/embed, no framing, and form posts and base
// URI pinned to self. 'unsafe-eval' is added only in development (React/Turbopack need it there).
// style-src needs 'unsafe-inline' because React Flow positions nodes with inline style attributes.
// Follow-up: move to nonces (most routes are already dynamic).

function dsnOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Headers are computed at build/start (next.config.ts), so a DSN change needs a redeploy.
// connect-src gets only the exact origins of the configured DSNs, no Sentry wildcards: a wildcard would let
// any Sentry customer's ingest host act as an exfiltration path. No DSN means no Sentry host at all.
// upgradeInsecure is set by the caller only for real HTTPS deployments (not dev, not local http `next start`).
export type HeaderEnv = {
  dev: boolean;
  sentryDsns?: (string | undefined)[];
  upgradeInsecure?: boolean;
};

export function buildCsp(env: HeaderEnv): string {
  const sentry = [
    ...new Set((env.sentryDsns ?? []).map(dsnOrigin).filter((x): x is string => x !== null)),
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
    "frame-src": ["'none'"],
    "media-src": ["'none'"],
    "manifest-src": ["'self'"],
    ...(env.upgradeInsecure ? { "upgrade-insecure-requests": [] } : {}),
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

const DENIED_FEATURES = [
  "accelerometer",
  "autoplay",
  "bluetooth",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "interest-cohort",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
  "xr-spatial-tracking",
];

// clipboard-write stays allowed for self: the share-link copy button needs it. HSTS is set by Vercel.
export const PERMISSIONS_POLICY = [
  ...DENIED_FEATURES.map((f) => `${f}=()`),
  "clipboard-write=(self)",
].join(", ");

export function securityHeaders(env: HeaderEnv) {
  return [
    { key: "Content-Security-Policy", value: buildCsp(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
}
