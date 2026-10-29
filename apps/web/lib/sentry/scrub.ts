// Pure scrubbing for Sentry events: no emails, no secret-looking strings leave the app.

const REDACTED = "[redacted]";
const MAX_DEPTH = 12;

// Order matters: URLs with credentials first, then tokens, then emails.
const STRING_RULES: Array<[RegExp, string]> = [
  // Connection strings: any scheme with userinfo (user, password, host), plus postgres urls.
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>/@]+@[^\s'"<>]+/gi, "[redacted-url]"],
  [/\bpostgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[redacted-url]"],
  // Authorization headers and bearer tokens.
  [/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]"],
  // key=value / "key": "value" for secret-looking names.
  [
    /\b(api[_-]?key|access[_-]?key|secret|token|password|passwd|authorization|dsn)(["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi,
    `$1$2${REDACTED}`,
  ],
  // Well-known token prefixes (Stripe, GitHub, Slack, AWS, Sentry).
  [/\b(?:sk|pk|rk|ghp|gho|ghs|github_pat|xox[abp]|AKIA|sntrys)[-_A-Za-z0-9]{10,}/g, REDACTED],
  // Long opaque strings containing both letters and digits (hex/base64 keys).
  [/\b(?=[A-Za-z_-]*\d)(?=[0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, REDACTED],
  // Emails.
  [/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi, "[email]"],
];

const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[_-]?key|authorization|cookie|dsn|e-?mail|ip_address/i;

export function scrubString(input: string): string {
  let out = input;
  for (const [re, replacement] of STRING_RULES) out = out.replace(re, replacement);
  return out;
}

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubValue(value[i], depth + 1, seen);
    return value;
  }
  const rec = value as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (SENSITIVE_KEY.test(key) && rec[key] != null && typeof rec[key] !== "object") {
      rec[key] = REDACTED;
    } else {
      rec[key] = scrubValue(rec[key], depth + 1, seen);
    }
  }
  return value;
}

/** Scrub an event in place and return it. Generic so it fits any Sentry event type. */
export function scrubEvent<T extends object>(event: T): T {
  const e = event as Record<string, unknown>;
  // Never send user identity or request cookies.
  delete e.user;
  const req = e.request as Record<string, unknown> | undefined;
  if (req) {
    delete req.cookies;
    delete req.data;
  }
  return scrubValue(event, 0, new WeakSet()) as T;
}
