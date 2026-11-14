import type Stripe from "stripe";
import { getStripe, isSessionPaid } from "@/lib/stripe";

/**
 * POST /api/stripe/webhook: verifies the signature and acknowledges the event. Pro is granted in the
 * browser that paid (GET /api/pro/claim sets the signed cookie); with no database there is nothing to
 * record here, so completed checkouts are only logged. 503 when STRIPE_WEBHOOK_SECRET is unset.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.info(
      `stripe webhook: checkout ${session.id} completed, paid=${isSessionPaid(session)}, plan=${session.metadata?.plan ?? "?"}`,
    );
  }
  return Response.json({ received: true });
}
