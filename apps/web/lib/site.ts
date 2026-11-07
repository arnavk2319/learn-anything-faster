import { APP_NAME, APP_TAGLINE } from "../../../lib/brand";

// The one place the public site origin is read. Set NEXT_PUBLIC_SITE_URL once a custom domain exists.
const DEFAULT_SITE_URL = "https://learn-anything-faster.vercel.app";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export { APP_NAME, APP_TAGLINE };
