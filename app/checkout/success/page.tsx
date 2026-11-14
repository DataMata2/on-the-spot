import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Blob, PaperCard, ScreenField } from "@/components/kit";
import { buttonClasses } from "@/components/kit/Button";
import { Footer } from "@/components/site/Footer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CLAIM_ERRORS, isProRequest } from "@/lib/pro";

export const metadata: Metadata = { title: "Checkout — On the Spot" };

type Search = PageProps<"/checkout/success">["searchParams"];

export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="lemon"
          className="flex flex-1 flex-col justify-center pt-10 pb-20 sm:pt-16 sm:pb-28"
          innerClassName="flex justify-center"
          deco={
            <>
              <div className="absolute -right-28 -bottom-24 size-[260px] rounded-full bg-cobalt lg:-right-40 lg:-bottom-48 lg:size-[480px]" />
              <div className="stripe-band absolute inset-x-0 bottom-0 h-[22px] text-ink lg:h-7" />
            </>
          }
        >
          <PaperCard as="section" sticker className="relative w-full max-w-md text-center">
            <Suspense fallback={<p className="text-base text-ink-2">Confirming your payment…</p>}>
              <Confirm searchParams={searchParams} />
            </Suspense>
          </PaperCard>
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Stripe sends the buyer here with ?session_id. Cookies can't be set while a page renders, so the session is
 * handed to GET /api/pro/claim, which verifies it with Stripe, sets the Pro cookie and comes back with ?ok=1
 * or ?error=. What this page shows comes from the verified cookie, never from the query string.
 */
async function Confirm({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const sessionId = one(params.session_id);
  if (sessionId) redirect(`/api/pro/claim?session_id=${encodeURIComponent(sessionId)}`);

  if (await isProRequest()) {
    return (
      <>
        <Blob state="proud" size={72} className="mx-auto -mt-1 mb-4" />
        <h1 className="type-display text-[34px] leading-none text-ink sm:text-[44px]">You&apos;re on Pro</h1>
        <p className="mt-3 text-base text-ink-2">
          Thanks! Unlimited drills, Clarify the vague task and Rehearse my real meeting are unlocked in this browser.
        </p>
        <Link href="/progress" className={buttonClasses({ size: "lg", fullWidth: true, className: "mt-6" })}>
          Go to my progress
        </Link>
        <div className="mt-3 flex flex-col items-center gap-1">
          <Link href="/drill" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-ink underline decoration-2 underline-offset-4 hover:decoration-cobalt">
            Start a drill
          </Link>
          <Link href="/rehearse" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-ink underline decoration-2 underline-offset-4 hover:decoration-cobalt">
            Rehearse my real meeting
          </Link>
        </div>
      </>
    );
  }

  const error = one(params.error);
  const message = error && (CLAIM_ERRORS as readonly string[]).includes(error) ? error : "We couldn't confirm a payment for this browser.";
  return (
    <>
      <Blob state="thinking" size={64} className="mx-auto mb-4" />
      <h1 className="type-display text-[34px] leading-none text-ink sm:text-[40px]">Payment not confirmed</h1>
      <p className="mt-3 text-base text-ink">{message}</p>
      <p className="mt-2 text-sm text-ink-2">If you paid, open this page in the same browser you started checkout in.</p>
      <Link href="/pricing" className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true, className: "mt-6" })}>
        Back to pricing
      </Link>
    </>
  );
}
