import { getOrCreateGuestId } from "@/lib/guest";
import { isProRequest } from "@/lib/pro";
import { createCheckoutSession, DEFAULT_PLAN, getOrigin, isPlanId, type PlanId } from "@/lib/stripe";

/** POST /api/checkout: form ({plan}) → 303 to Stripe (or to /pricing?error=checkout on failure); JSON ({plan}) → { url }. */
export async function POST(req: Request) {
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  let plan: unknown = DEFAULT_PLAN;
  try {
    if (isJson) {
      const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
      plan = body.plan ?? DEFAULT_PLAN;
    } else {
      const form = await req.formData().catch(() => null);
      plan = form?.get("plan") ?? DEFAULT_PLAN;
    }
  } catch {
    // fall through with default plan
  }
  const origin = getOrigin(req);
  // A plain form POST navigates the page, so an error goes back to /pricing with a friendly message, not raw JSON.
  const formError = () => Response.redirect(`${origin}/pricing?error=checkout`, 303);
  if (!isPlanId(plan)) return isJson ? Response.json({ error: "Unknown plan" }, { status: 400 }) : formError();

  try {
    const guestId = await getOrCreateGuestId();
    // Already Pro in this browser: nothing to buy, go practice.
    if (await isProRequest()) {
      return isJson ? Response.json({ url: `${origin}/progress` }) : Response.redirect(`${origin}/progress`, 303);
    }
    const session = await createCheckoutSession({ plan: plan as PlanId, guestId, origin });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return isJson ? Response.json({ url: session.url }) : Response.redirect(session.url, 303);
  } catch (err) {
    console.error("POST /api/checkout failed:", err instanceof Error ? err.message : err);
    return isJson ? Response.json({ error: "Could not start checkout" }, { status: 500 }) : formError();
  }
}
