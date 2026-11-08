import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

// The one place the public site origin is read. Set NEXT_PUBLIC_SITE_URL once a custom domain exists.
const DEFAULT_SITE_URL = "https://learn-anything-faster.vercel.app";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

// Until a product name is chosen, brand.ts holds a "[..." placeholder; show the working name instead.
export function siteNameFor(appName: string): string {
  return appName.startsWith("[") ? "Learn Anything Faster" : appName;
}
export const SITE_NAME = siteNameFor(APP_NAME);
export { APP_TAGLINE };
