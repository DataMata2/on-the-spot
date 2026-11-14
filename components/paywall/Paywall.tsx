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

/**
 * The Pro card: why it's showing, the plan choice and checkout button, the billing and test-mode notes, then what
 * Pro unlocks. A self-contained paper card, so it reads the same on any screen field (lemon pricing, night drill,
 * pink progress, cobalt rehearse).
 */
export function Paywall({ reason, defaultPlan, title = "On the Spot Pro", className }: PaywallProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      data-field="paper"
      className={cx("w-full max-w-md rounded-card bg-paper text-ink", className)}
    >
      {reason && (
        <div className="flex items-start gap-2.5 rounded-t-card border-b-2 border-ink bg-lemon px-5 py-3.5 text-[0.9375rem] leading-snug font-medium text-ink sm:px-7">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
          <p>{reason}</p>
        </div>
      )}

      <div className="flex flex-col gap-5 p-5 sm:gap-6 sm:p-7">
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="type-display text-[28px] leading-none text-ink sm:text-[34px]">
            {title}
          </h2>
          <p className="text-[0.9375rem] leading-snug text-ink-2">Practice every day until answering on the spot feels normal.</p>
        </div>

        <PlanPicker defaultPlan={defaultPlan} />

        <div className="-mt-1 flex flex-col gap-3">
          <p className="text-sm leading-normal text-ink">
            No account needed: Pro is tied to this browser. Subscription details are shown on the Stripe page.
          </p>

          <div className="flex items-start gap-2.5 rounded-lg border-2 border-dashed border-ink px-4 py-3 text-sm leading-normal text-ink">
            <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
            <p>
              <span className="font-semibold">Test mode: no real charge.</span> Pay with card{" "}
              <span className="font-mono font-medium tracking-[0.04em] whitespace-nowrap tabular-nums">4242 4242 4242 4242</span>, any future date, any
              CVC.
            </p>
          </div>

          <p className="text-[13px] text-ink-2">For comparison: Spleek $14.99/mo · BoldVoice ~$150/yr</p>
        </div>

        <ul className="flex flex-col gap-4 border-t-2 border-ink pt-5">
          {UNLOCKS.map((u) => (
            <li key={u.title} className="flex gap-3">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink">
                <Check className="size-4 text-lemon" strokeWidth={3.5} />
              </span>
              <span className="flex flex-col">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {u.title}
                  {u.soon && (
                    <span className="rounded-pill bg-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-2">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="text-[0.9375rem] leading-snug text-ink-2">{u.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
