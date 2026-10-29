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
          sentryDsns: [process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN],
        }),
      },
    ];
  },
};

export default config;
