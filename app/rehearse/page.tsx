import type { Metadata } from "next";
import { Suspense } from "react";
import { Paywall } from "@/components/paywall/Paywall";
import { RehearseFlow } from "@/components/rehearse/RehearseFlow";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";
import { TYPE_LABELS, type QuestionType } from "@/lib/drill1/questions";
import { isProRequest } from "@/lib/pro";
import { REHEARSE_COUNT } from "@/lib/rehearse/questions";

export const metadata: Metadata = {
  title: "Rehearse my real meeting — On the Spot",
  description: "Paste your meeting agenda, get the questions you're likely to face, and answer them out loud first.",
};

/** A static sample of what the feature produces, for the free preview. */
const SAMPLE: { type: QuestionType; context: string; text: string }[] = [
  { type: "status", context: "Item 1. Dana (VP Product) turns to you:", text: "Quick one: are we still on for the March 3 checkout launch with those Safari bugs?" },
  { type: "decision", context: "Item 2. The finance partner asks:", text: "So, Stripe or Adyen? What's your recommendation?" },
  { type: "estimate", context: "Item 3. Dana again:", text: "How long would Apple Pay take if we started next sprint?" },
];

function Preview() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Pro · Rehearse my real meeting</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Practice the questions you&apos;ll actually get.</h1>
        <p className="text-base text-ink-2">
          Paste the agenda of your next meeting. We write the {REHEARSE_COUNT} questions someone in that room is most likely to ask you, then you
          answer each one out loud and get the same feedback as the cold-question drill: did your first sentence answer it, and a stronger
          version in your own words.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Example: from a weekly product sync agenda</h2>
        <ul className="flex flex-col gap-3">
          {SAMPLE.map((q) => (
            <li key={q.text} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs font-semibold tracking-wide text-accent uppercase">{TYPE_LABELS[q.type]}</p>
              <p className="mt-1 text-sm text-ink-2">{q.context}</p>
              <p className="mt-1 text-base font-semibold text-ink">“{q.text}”</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center">
        <Paywall reason="Rehearse my real meeting is part of Pro." />
      </div>
    </section>
  );
}

async function RehearseGate() {
  return (await isProRequest()) ? <RehearseFlow /> : <Preview />;
}

export default function RehearsePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-3 py-10 text-ink-2" role="status">
              <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
              Loading…
            </div>
          }
        >
          <RehearseGate />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
