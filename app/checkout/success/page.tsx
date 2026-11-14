import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <section className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 text-center shadow-raised">
          <Suspense fallback={<p className="text-sm text-ink-2">Confirming your payment…</p>}>
            <Confirm searchParams={searchParams} />
          </Suspense>
        </section>
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
        <h1 className="text-xl font-bold text-ink">You&apos;re on Pro</h1>
        <p className="mt-2 text-sm text-ink-2">
          Thanks! Unlimited drills, Clarify the vague task and Rehearse my real meeting are unlocked in this browser.
        </p>
        <Link href="/progress" className={buttonClasses({ fullWidth: true, className: "mt-6" })}>
          Go to my progress
        </Link>
        <div className="mt-3 flex flex-col items-center gap-2">
          <Link href="/drill" className="inline-flex items-center max-sm:min-h-11 text-sm font-medium text-accent underline underline-offset-4">
            Start a drill
          </Link>
          <Link href="/rehearse" className="inline-flex items-center max-sm:min-h-11 text-sm font-medium text-accent underline underline-offset-4">
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
      <h1 className="text-xl font-bold text-ink">Payment not confirmed</h1>
      <p className="mt-2 text-sm text-ink-2">{message}</p>
      <p className="mt-2 text-xs text-ink-3">If you paid, open this page in the same browser you started checkout in.</p>
      <Link href="/pricing" className={buttonClasses({ variant: "secondary", fullWidth: true, className: "mt-6" })}>
        Back to pricing
      </Link>
    </>
  );
}
