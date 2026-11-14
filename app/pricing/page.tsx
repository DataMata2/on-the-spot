import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Blob, Notice, PaperCard, ScreenField, Sticker } from "@/components/kit";
import { Footer } from "@/components/site/Footer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Paywall } from "@/components/paywall/Paywall";
import { buttonClasses } from "@/components/kit/Button";
import { formatUsd, PLANS, yearlySavingsPercent } from "@/lib/plans";
import { isProRequest } from "@/lib/pro";

export const metadata: Metadata = {
  title: "Pricing — On the Spot",
  description: "Free: 3 spoken drills a day. Pro: unlimited drills, Clarify the vague task, and Rehearse my real meeting. $12/month or $79/year.",
};

const FREE = ["3 drills a day", "One try of Clarify the vague task", "Your progress, saved in this browser"];

/** Grid placement on the lemon field: paywall in the right column on desktop, free tier under the hero copy. */
const PRO_AREA = "lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-w-none lg:self-start";
const FREE_AREA = "lg:col-start-1 lg:row-start-3";

/** The free tier, shown next to the paywall (not to Pro users). */
function FreeCard() {
  return (
    <aside className={`w-full max-w-md border-t-2 border-ink pt-6 lg:max-w-[560px] ${FREE_AREA}`}>
      <h2 className="type-display text-[28px] leading-none text-ink">Free</h2>
      <p className="mt-2 text-base text-ink">$0, no sign-up.</p>
      <ul className="mt-4 flex flex-col gap-2 text-base text-ink">
        {FREE.map((f) => (
          <li key={f} className="flex gap-3">
            <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-ink" />
            {f}
          </li>
        ))}
      </ul>
      <Link href="/drill" className={buttonClasses({ variant: "secondary", size: "lg", className: "mt-6 max-sm:w-full" })}>
        Try a free drill
      </Link>
      <p className="mt-6 max-w-[46ch] text-sm text-ink-2">
        We never score your accent. Feedback is about whether your answer landed: clear point, right length, a
        next step.
      </p>
    </aside>
  );
}

/** Pro users see their plan; everyone else the paywall and the free tier. */
async function PlanArea() {
  if (await isProRequest()) {
    return (
      <PaperCard as="section" sticker className={`w-full max-w-md text-center ${PRO_AREA}`}>
        <Blob state="proud" size={64} className="mx-auto" />
        <h2 className="type-display mt-3 text-[34px] leading-none text-ink">You&apos;re on Pro</h2>
        <p className="mt-3 text-base text-ink-2">
          Unlimited drills, Clarify the vague task and Rehearse my real meeting are unlocked in this browser.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/drill" className={buttonClasses({})}>
            Start a drill
          </Link>
          <Link href="/rehearse" className={buttonClasses({ variant: "secondary" })}>
            Rehearse my real meeting
          </Link>
        </div>
      </PaperCard>
    );
  }
  return (
    <>
      <Paywall className={PRO_AREA} />
      <FreeCard />
    </>
  );
}

const PRICE_STAGE = "relative hidden h-[300px] lg:col-start-1 lg:row-start-2 lg:block";

/**
 * Desktop-only stage: the yearly price as a scalloped sticker, a cobalt orb and the proud blob. Pro users keep
 * the orb and blob but not the price sticker (no sales pitch to someone who already pays).
 */
async function PriceStage() {
  const pro = await isProRequest();
  const savings = yearlySavingsPercent();
  return (
    <div aria-hidden="true" className={PRICE_STAGE}>
      <div className="absolute top-0 left-[120px] size-[280px] rounded-full bg-cobalt" />
      <Blob state="proud" size={96} body="var(--color-ink)" face="var(--color-paper)" bob className="absolute -top-2 left-[350px]" />
      {!pro && (
        <Sticker tone="tomato" size={240} className="absolute! top-8 left-5">
          <b className="type-display text-[60px] leading-[0.95]">{formatUsd(PLANS.yearly.amountCents)}</b>
          <span className="type-label mt-1.5">a year</span>
          {savings > 0 && (
            <span className="mt-2 rounded-pill bg-ink px-2.5 py-0.5 text-[13px] font-bold text-paper">save {savings}%</span>
          )}
        </Sticker>
      )}
    </div>
  );
}

type SearchParams = Promise<{ error?: string | string[] }>;

/** /api/checkout sends a failed form checkout back here with ?error=checkout. */
async function CheckoutError({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  if (error !== "checkout") return null;
  return (
    <Notice role="alert" tone="warning" className="mt-5 max-w-md font-medium">
      Checkout couldn&apos;t start. Please try again.
    </Notice>
  );
}

export default function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="lemon"
          className="flex-1 pt-4 pb-16 sm:pt-8 lg:pt-12 lg:pb-24"
          innerClassName="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-x-20 lg:gap-y-10"
        >
          <div className="flex flex-col lg:col-start-1 lg:row-start-1">
            <p className="type-label text-ink">Pricing</p>
            <h1 className="type-display mt-2 max-w-[14ch] text-[clamp(32px,9.4vw,40px)] leading-[0.98] text-ink sm:text-[56px] lg:mt-4 lg:text-[88px] lg:leading-[0.95]">
              Say it on the spot, without the freeze.
            </h1>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-snug text-ink sm:text-base lg:mt-5 lg:text-lg">
              Short spoken drills for real work moments. Start free; go Pro when you want to practice every day.
            </p>

            <Suspense fallback={null}>
              <CheckoutError searchParams={searchParams} />
            </Suspense>
          </div>

          <Suspense fallback={<div aria-hidden="true" className={PRICE_STAGE} />}>
            <PriceStage />
          </Suspense>

          <Suspense
            fallback={
              <>
                <Paywall className={PRO_AREA} />
                <FreeCard />
              </>
            }
          >
            <PlanArea />
          </Suspense>
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}
