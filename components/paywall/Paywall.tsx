import { Check, CreditCard, Info } from "lucide-react";
import { useId } from "react";
import { cx } from "@/components/kit/cx";
import type { PlanId } from "@/lib/plans";
import { PlanPicker } from "./PlanPicker";

/**
 * Flip to true once "Rehearse my real meeting" ships; until then the paywall lists it honestly as coming soon.
 */
export const REHEARSE_AVAILABLE = true;

const UNLOCKS: { title: string; detail: string; soon?: boolean }[] = [
  { title: "Unlimited drills", detail: "Free is 3 drills a day. Pro has no daily cap." },
  { title: "Clarify the vague task", detail: "Drill 2: turn \"can you look into this?\" into a clear ask, out loud." },
  {
    title: "Rehearse my real meeting",
    detail: "Paste your agenda and get the questions you're likely to face.",
    soon: !REHEARSE_AVAILABLE,
  },
];

export interface PaywallProps {
  /** Why the paywall is showing, e.g. "You've used today's 3 free drills". Shown as a quiet banner on top. */
  reason?: string;
  /** Plan selected at first. Yearly by default. */
  defaultPlan?: PlanId;
  /** Heading text. */
  title?: string;
  className?: string;
}

/** The Pro card: why it's showing, what Pro unlocks, the plan choice and checkout button, and the test-mode note. */
export function Paywall({ reason, defaultPlan, title = "On the Spot Pro", className }: PaywallProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cx("w-full max-w-md rounded-lg border border-line bg-surface shadow-raised", className)}
    >
      {reason && (
        <div className="flex items-start gap-2.5 rounded-t-lg border-b border-line bg-sunken px-5 py-3 text-sm text-ink sm:px-6">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-2" />
          <p>{reason}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="text-xl font-bold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <p className="text-sm text-ink-2">Practice every day until answering on the spot feels normal.</p>
        </div>

        <ul className="flex flex-col gap-3">
          {UNLOCKS.map((u) => (
            <li key={u.title} className="flex gap-3">
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft">
                <Check className="size-3.5 text-accent" strokeWidth={3} />
              </span>
              <span className="flex flex-col">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {u.title}
                  {u.soon && (
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-2">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="text-sm text-ink-2">{u.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <PlanPicker defaultPlan={defaultPlan} />

        <div className="flex flex-col gap-1 text-center text-xs text-ink-3">
          <p>No account needed: Pro is tied to this browser. Subscription details are shown on the Stripe page.</p>
          <p>For comparison: Spleek $14.99/mo · BoldVoice ~$150/yr</p>
        </div>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-mid/50 bg-amber-soft px-3.5 py-3 text-xs text-ink">
          <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0 text-amber" />
          <p>
            <span className="font-semibold">Test mode: no real charge.</span> Pay with card{" "}
            <span className="font-semibold whitespace-nowrap tabular-nums">4242 4242 4242 4242</span>, any future date, any
            CVC.
          </p>
        </div>
      </div>
    </section>
  );
}
