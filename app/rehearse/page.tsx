import type { Metadata } from "next";
import { Suspense } from "react";
import { Blob, PaperCard } from "@/components/kit";
import { Paywall } from "@/components/paywall/Paywall";
import { RehearseField, RehearseFlow } from "@/components/rehearse/RehearseFlow";
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

const TILTS = [-1, 0.8, -0.6];

function Preview() {
  return (
    <RehearseField>
      <section className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_448px] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="type-label text-field-mark">Pro · Rehearse my real meeting</p>
              <Blob state="thinking" size={48} bob />
            </div>
            <h1 className="type-display max-w-[14ch] text-[clamp(40px,11vw,80px)] leading-[0.98] text-field-fg">Practice the questions you&apos;ll actually get.</h1>
            <p className="max-w-[58ch] text-lg text-field-muted">
              Paste the agenda of your next meeting. We write the {REHEARSE_COUNT} questions someone in that room is most likely to ask you, then you
              answer each one out loud and get the same feedback as the cold-question drill: did your first sentence answer it, and a stronger
              version in your own words.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="type-label text-field-fg">Example: from a weekly product sync agenda</h2>
            <ul className="flex flex-col gap-6">
              {SAMPLE.map((q, i) => (
                <PaperCard as="li" key={q.text} padding="sm" sticker="sm" tilt={TILTS[i % TILTS.length]}>
                  <p className="type-label inline-block rounded-pill bg-cobalt px-2.5 py-1 text-[11px] text-paper">{TYPE_LABELS[q.type]}</p>
                  <p className="mt-2.5 text-sm text-ink-2">{q.context}</p>
                  <p className="type-heading mt-1 text-[20px] leading-[1.2] text-ink">“{q.text}”</p>
                </PaperCard>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-center lg:sticky lg:top-6">
          <div data-field="paper" className="w-full max-w-md bg-transparent">
            <Paywall reason="Rehearse my real meeting is part of Pro." />
          </div>
        </div>
      </section>
    </RehearseField>
  );
}

async function RehearseGate() {
  return (await isProRequest()) ? <RehearseFlow /> : <Preview />;
}

export default function RehearsePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Suspense
          fallback={
            <RehearseField>
              <div className="flex items-center justify-center gap-3 py-10 text-field-muted" role="status">
                <span className="size-4 motion-safe:animate-spin rounded-full border-2 border-field-mark border-t-transparent" aria-hidden="true" />
                Loading…
              </div>
            </RehearseField>
          }
        >
          <RehearseGate />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
