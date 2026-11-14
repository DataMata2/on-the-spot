import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Body: Instrument Sans. Display: Bricolage Grotesque (variable; opsz + wdth axes for the big type).
// Labels: DM Mono 500. All three are CSS variables mapped in globals.css (@theme --font-*).
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz", "wdth"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "On the Spot — answer on the spot at work",
  description:
    "Short spoken drills for the moments English at work goes quiet: answer a question on the spot, then clarify a vague task. Practice out loud, get one clear fix, try again.",
};

export const viewport: Viewport = {
  themeColor: "#FFFDF7",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${bricolage.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
