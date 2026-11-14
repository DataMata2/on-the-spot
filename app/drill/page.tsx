import type { Metadata } from "next";
import { Drill1Flow } from "@/components/drill/Drill1Flow";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Cold question drill — On the Spot",
  description: "Answer a surprise meeting question out loud and get feedback on what you said.",
};

export default function DrillPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Drill1Flow />
      </main>
      <Footer />
    </>
  );
}
