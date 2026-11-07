import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE_NAME, APP_TAGLINE, getSiteUrl } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: APP_TAGLINE,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: APP_TAGLINE,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: APP_TAGLINE },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
