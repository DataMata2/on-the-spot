import type { Metadata } from "next";
import { ScreenField } from "@/components/kit";
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
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="pink"
          className="flex-1 pt-6 pb-16 sm:pt-10 lg:pb-24"
          deco={<div className="absolute top-24 -right-28 size-[240px] rounded-full bg-lemon lg:top-10 lg:right-[34%] lg:size-[360px]" />}
        >
          <ProgressCard />
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}
