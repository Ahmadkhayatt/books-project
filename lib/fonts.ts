import { Amiri, Fraunces, Newsreader, Noto_Sans_Arabic } from "next/font/google";

// Self-hosted via next/font — no runtime font CDN (DESIGN.md §3).
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
});

export const fontVariables = [
  fraunces.variable,
  newsreader.variable,
  amiri.variable,
  notoSansArabic.variable,
].join(" ");
