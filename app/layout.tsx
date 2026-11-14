import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Public Sans: a plain, sturdy grotesque that stays readable at every size.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "On the Spot — answer on the spot at work",
  description:
    "Short spoken drills for the moments English at work goes quiet: answer a question on the spot, then clarify a vague task. Practice out loud, get one clear fix, try again.",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
