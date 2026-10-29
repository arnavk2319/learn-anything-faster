// Client IP for the rate limiter. Assumes deployment on Vercel, which sets x-vercel-forwarded-for (and x-real-ip)
// itself and overwrites any client-supplied value; x-forwarded-for can carry client-injected entries, so it is last.
export function clientIp(h: { get(name: string): string | null }): string {
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
