// SSRF guard for the link checker. Pure except for the injected DNS lookup.
import { isIP } from "node:net";

export type LookupFn = (host: string) => Promise<{ address: string; family: number }[]>;

export type GuardResult =
  { ok: true; url: URL } | { ok: false; reason: "blocked" | "notfound" | "error" };

function ipv4Blocked(a: number, b: number, c: number): boolean {
  return (
    a === 0 || // unspecified / "this network"
    (a === 198 && (b === 18 || b === 19)) || // benchmarking 198.18.0.0/15
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments 192.0.0.0/24
    a >= 224 // multicast, reserved, broadcast
  );
}

function expandV6(ip: string): number[] | null {
  let s = ip.split("%")[0]!;
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const n = v4.slice(1).map(Number);
    if (n.some((x) => x > 255)) return null;
    s = s.slice(0, v4.index) + ((n[0]! << 8) | n[1]!).toString(16);
    s += ":" + ((n[2]! << 8) | n[3]!).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g)) ? groups : null;
}

/** True for loopback, private, link-local, CGNAT, unspecified, multicast and their IPv6 equivalents. Unparseable = blocked. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return ipv4Blocked(a!, b!, c!);
  }
  if (kind === 6) {
    const g = expandV6(ip);
    if (!g) return true;
    if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
      // v4-mapped (::ffff:a.b.c.d) and deprecated v4-compatible (::a.b.c.d, includes :: and ::1)
      return g[5] === 0 && g[6] === 0 && g[7]! <= 1
        ? true
        : ipv4Blocked(g[6]! >> 8, g[6]! & 255, g[7]! >> 8);
    }
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return true; // NAT64 64:ff9b::/96
    const first = g[0]!;
    return (
      (first & 0xfe00) === 0xfc00 || // fc00::/7
      (first & 0xffc0) === 0xfe80 || // fe80::/10
      (first & 0xff00) === 0xff00 || // multicast
      first === 0x2002 // 6to4 2002::/16
    );
  }
  return true;
}

/** Validates scheme, credentials, port and every resolved address. */
export async function guardUrl(raw: string, lookup: LookupFn): Promise<GuardResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "blocked" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false, reason: "blocked" };
  if (url.username || url.password) return { ok: false, reason: "blocked" };
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") return { ok: false, reason: "blocked" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isBlockedIp(host) ? { ok: false, reason: "blocked" } : { ok: true, url };
  try {
    const addrs = await lookup(host);
    if (addrs.length === 0) return { ok: false, reason: "notfound" };
    if (addrs.some((a) => isBlockedIp(a.address))) return { ok: false, reason: "blocked" };
    return { ok: true, url };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, reason: code === "ENOTFOUND" ? "notfound" : "error" };
  }
}
