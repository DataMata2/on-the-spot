import type { Metadata } from "next";
import { ClarifyFlow } from "@/components/clarify/ClarifyFlow";
import { ScreenField } from "@/components/kit";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Clarify the vague task — On the Spot",
  description: "Your manager gives a vague task. Ask clarifying questions out loud, confirm it back, and see which details you caught.",
};

export default function ClarifyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="night"
          spotlight
          className="flex-1 pt-6 pb-16 sm:pt-10 lg:pb-24"
          deco={<div className="absolute -right-56 top-40 hidden size-[420px] rounded-full border-[56px] border-paper/[0.06] lg:block" />}
        >
          <div className="mx-auto w-full max-w-[720px]">
            <ClarifyFlow />
          </div>
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}
