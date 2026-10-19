import { Familjen_Grotesk, Hanken_Grotesk } from "next/font/google";

// Display: headlines, role sentence, area names, wordmark (DESIGN.md section 3)
export const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-familjen",
  display: "swap",
});

// UI and body
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

// In app/layout.tsx:
// <html lang="en" className={`${familjen.variable} ${hanken.variable}`}>
