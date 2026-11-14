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
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Choose a plan</legend>
        {OPTIONS.map((o) => {
          const checked = plan === o.id;
          return (
            <label
              key={o.id}
              className={cx(
                "relative flex cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-3.5 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                checked ? "border-accent ring-1 ring-accent" : "border-line-strong hover:border-ink-3",
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
                className={cx(
                  "grid size-5 shrink-0 place-items-center rounded-full border-2",
                  checked ? "border-accent" : "border-line-strong",
                )}
              >
                <span className={cx("size-2.5 rounded-full", checked ? "bg-accent" : "bg-transparent")} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {o.label}
                  {o.id === "yearly" && savings > 0 && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
                      Save {savings}%
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-3">{o.note}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="text-lg font-bold text-ink">{o.price}</span>
                <span className="text-xs text-ink-3"> {o.per}</span>
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
