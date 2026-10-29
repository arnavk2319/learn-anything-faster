import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@laf/graph"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          dev: process.env.NODE_ENV !== "production",
          // https-only upgrade: real deployments only. VERCEL is set on Vercel builds/runtime; plain
          // `next start` over http (local e2e) has no VERCEL, so it must not upgrade to https.
          upgradeInsecure: process.env.NODE_ENV === "production" && !!process.env.VERCEL,
          sentryDsns: [process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN],
        }),
      },
    ];
  },
};

export default config;
