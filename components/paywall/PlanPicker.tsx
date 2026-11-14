"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { DEFAULT_PLAN, formatUsd, PLANS, yearlySavingsPercent, type PlanId } from "@/lib/plans";

const OPTIONS: { id: PlanId; label: string; price: string; per: string; note: string }[] = [
  {
    id: "yearly",
    label: "Yearly",
    price: formatUsd(PLANS.yearly.amountCents),
    per: "/ year",
    note: `${formatUsd(Math.round(PLANS.yearly.amountCents / 12))} a month, billed yearly`,
  },
  {
    id: "monthly",
    label: "Monthly",
    price: formatUsd(PLANS.monthly.amountCents),
    per: "/ month",
    note: "Billed every month",
  },
];

/**
 * Plan choice + the checkout button. A plain form POST to /api/checkout (it answers 303 to Stripe), so it
 * works before hydration too; the state only drives the "opening checkout" label.
 */
export function PlanPicker({ defaultPlan = DEFAULT_PLAN }: { defaultPlan?: PlanId }) {
  const [plan, setPlan] = useState<PlanId>(defaultPlan);
  const [submitting, setSubmitting] = useState(false);
  const savings = yearlySavingsPercent();

  // Coming back with the browser's Back button (bfcache) must not leave the button stuck on "Opening…".
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return (
    <form action="/api/checkout" method="post" onSubmit={() => setSubmitting(true)} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Choose a plan</legend>
        {OPTIONS.map((o) => {
          const checked = plan === o.id;
          return (
            <label
              key={o.id}
              className={cx(
                "relative flex min-h-[76px] cursor-pointer items-center gap-3 rounded-chip px-4 py-3 text-ink transition-[background-color,box-shadow] sm:gap-3.5 sm:px-[18px]",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-field-ring",
                checked
                  ? "bg-paper shadow-[inset_0_0_0_3px_var(--color-ink)]"
                  : "bg-sunken shadow-[inset_0_0_0_2px_transparent] hover:shadow-[inset_0_0_0_2px_var(--color-ink)]",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={o.id}
                checked={checked}
                onChange={() => setPlan(o.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_2px_var(--color-ink)]"
              >
                <span className={cx("size-3 rounded-full", checked ? "bg-ink" : "bg-transparent")} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[17px] leading-snug font-semibold">
                  {o.label}
                  {o.id === "yearly" && savings > 0 && (
                    <span className="rounded-pill bg-tomato px-2 py-px text-xs leading-5 font-bold text-ink">
                      Save {savings}%
                    </span>
                  )}
                </span>
                <span className="text-[13px] leading-snug text-ink-2">{o.note}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end whitespace-nowrap min-[360px]:block min-[360px]:text-right">
                <span className="type-display text-[28px] leading-none">{o.price}</span>
                <span className="text-[13px] text-ink-2"> {o.per}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <button type="submit" disabled={submitting} className={buttonClasses({ size: "lg", fullWidth: true })}>
        {submitting ? "Opening secure checkout…" : "Continue to checkout"}
      </button>
    </form>
  );
}
