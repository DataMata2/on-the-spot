import type { Metadata } from "next";
import { ClarifyFlow } from "@/components/clarify/ClarifyFlow";
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <ClarifyFlow />
      </main>
      <Footer />
    </>
  );
}
