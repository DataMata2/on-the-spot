// Plan catalogue shared by the server (Stripe Checkout, lib/stripe.ts) and the paywall UI. No secrets, no
// server imports, so client components can import it.

/** On the Spot plans (yearly first); prices are created inline via price_data (no Stripe price objects needed). */
export const PLANS = {
  yearly: {
    name: "On the Spot Pro — yearly",
    description: "A year of On the Spot Pro: daily plan, Clarify drill, unlimited drills, rehearse your real meeting",
    amountCents: 7900,
    currency: "usd",
    interval: "year",
  },
  monthly: {
    name: "On the Spot Pro — monthly",
    description: "On the Spot Pro, billed monthly",
    amountCents: 1200,
    currency: "usd",
    interval: "month",
  },
} as const;

/** Key of a plan in PLANS. */
export type PlanId = keyof typeof PLANS;

/** Plan used when none is given. */
export const DEFAULT_PLAN: PlanId = "yearly";

/** Type guard for plan ids coming from forms/JSON. */
export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

/** Whole-dollar or cents price, e.g. "$79" or "$6.58". */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "usd",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Percent saved by paying yearly instead of 12 monthly payments, rounded down (45 for $79 vs $144). */
export function yearlySavingsPercent(): number {
  const twelveMonths = PLANS.monthly.amountCents * 12;
  return Math.floor(((twelveMonths - PLANS.yearly.amountCents) / twelveMonths) * 100);
}
