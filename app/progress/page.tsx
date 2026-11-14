import type { Metadata } from "next";
import { ProgressCard } from "@/components/progress/ProgressCard";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Your progress — On the Spot",
  description: "Today's drills, your streak, and tomorrow's drill.",
};

export default function ProgressPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <ProgressCard />
      </main>
      <Footer />
    </>
  );
}
