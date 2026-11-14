import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/site/Footer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Paywall } from "@/components/paywall/Paywall";
import { buttonClasses } from "@/components/kit/Button";
import { isProRequest } from "@/lib/pro";

export const metadata: Metadata = {
  title: "Pricing — On the Spot",
  description: "Free: 3 spoken drills a day. Pro: unlimited drills, Clarify the vague task, and Rehearse my real meeting. $12/month or $79/year.",
};

const FREE = ["3 drills a day", "One try of Clarify the vague task", "Your progress, saved in this browser"];

/** The free tier, shown next to the paywall (not to Pro users). */
function FreeCard() {
  return (
    <aside className="w-full max-w-md rounded-lg border border-line bg-paper p-5 sm:p-6 lg:max-w-xs">
      <h2 className="text-base font-bold text-ink">Free</h2>
      <p className="mt-1 text-sm text-ink-2">$0, no sign-up.</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-ink-2">
        {FREE.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
            {f}
          </li>
        ))}
      </ul>
      <Link href="/drill" className={buttonClasses({ variant: "secondary", fullWidth: true, className: "mt-5" })}>
        Try a free drill
      </Link>
      <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
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
      <section className="w-full max-w-md rounded-lg border border-accent-mid/50 bg-accent-soft p-6 text-center">
        <h2 className="text-xl font-bold text-ink">You&apos;re on Pro</h2>
        <p className="mt-2 text-sm text-ink-2">
          Unlimited drills, Clarify the vague task and Rehearse my real meeting are unlocked in this browser.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/drill" className={buttonClasses({})}>
            Start a drill
          </Link>
          <Link href="/rehearse" className={buttonClasses({ variant: "secondary" })}>
            Rehearse my real meeting
          </Link>
        </div>
      </section>
    );
  }
  return (
    <>
      <Paywall />
      <FreeCard />
    </>
  );
}

type SearchParams = Promise<{ error?: string | string[] }>;

/** /api/checkout sends a failed form checkout back here with ?error=checkout. */
async function CheckoutError({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  if (error !== "checkout") return null;
  return (
    <p role="alert" className="mx-auto w-full max-w-md rounded-md bg-amber-soft px-4 py-3 text-center text-sm text-amber">
      Checkout couldn&apos;t start. Please try again.
    </p>
  );
}

export default function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <p className="text-sm font-semibold text-accent">Pricing</p>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
            Say it on the spot, without the freeze.
          </h1>
          <p className="text-base text-ink-2">
            Short spoken drills for real work moments. Start free; go Pro when you want to practice every day.
          </p>
        </div>

        <Suspense fallback={null}>
          <CheckoutError searchParams={searchParams} />
        </Suspense>

        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          <Suspense
            fallback={
              <>
                <Paywall />
                <FreeCard />
              </>
            }
          >
            <PlanArea />
          </Suspense>

        </div>
      </main>
      <Footer />
    </>
  );
}
