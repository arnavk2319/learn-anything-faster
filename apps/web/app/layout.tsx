import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { APP_NAME, APP_TAGLINE, getSiteUrl } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_TAGLINE,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_TAGLINE,
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: APP_TAGLINE },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
