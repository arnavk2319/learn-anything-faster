import { Familjen_Grotesk, Hanken_Grotesk } from "next/font/google";

// Both are variable fonts: omitting `weight` loads the whole range (600/700 and 400-600 are covered).
// Display: headlines, role sentence, area names, wordmark (DESIGN.md section 3)
export const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-familjen",
  display: "swap",
});

// UI and body
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
