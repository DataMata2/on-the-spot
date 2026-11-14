import "server-only";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { getGuestId } from "@/lib/guest";
import { PRO_COOKIE, PRO_DURATION_MS, proSecretFromEnv, signProToken, verifyProToken } from "@/lib/pro-token";
import { getStripe, isSessionPaid } from "@/lib/stripe";

export { PRO_COOKIE } from "@/lib/pro-token";

/** Reads + verifies the ots_pro cookie for the current guest. Any problem answers false. */
export async function isProRequest(): Promise<boolean> {
  // No try/catch around the cookie reads: during prerendering they suspend on purpose and must not be swallowed.
  const guestId = await getGuestId();
  const token = (await cookies()).get(PRO_COOKIE)?.value;
  const secret = proSecretFromEnv();
  if (!secret || !guestId || !token) return false;
  return verifyProToken(token, guestId, secret);
}

/** Reasons GET /api/pro/claim may send back to /checkout/success; the page shows only these verbatim. */
export const CLAIM_ERRORS = [
  "Missing checkout session.",
  "No guest session found in this browser.",
  "That checkout link doesn't look right.",
  "Checkout session not found.",
  "This checkout was started in a different browser.",
  "Payment is not complete yet.",
  "We couldn't confirm the payment. Please try again.",
] as const;

export type ClaimResult = { ok: true; guestId: string; expiresAt: number } | { ok: false; reason: string };

/**
 * Retrieves the Checkout Session from Stripe and checks it is complete and paid and was started by this
 * guest (metadata.guestId == guest cookie). Never trusts anything but Stripe's answer.
 */
export async function verifyCheckoutForGuest(sessionId: string, guestId: string | null): Promise<ClaimResult> {
  if (!guestId) return { ok: false, reason: "No guest session found in this browser." };
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return { ok: false, reason: "That checkout link doesn't look right." };
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, reason: "Checkout session not found." };
  }
  if (session.metadata?.guestId !== guestId) return { ok: false, reason: "This checkout was started in a different browser." };
  if (!isSessionPaid(session)) return { ok: false, reason: "Payment is not complete yet." };
  const interval = session.metadata?.plan === "monthly" ? "month" : "year";
  return { ok: true, guestId, expiresAt: Date.now() + PRO_DURATION_MS[interval] };
}

/** Sets the signed httpOnly Pro cookie. Route handlers / server actions only. Throws when no secret is configured. */
export async function grantProCookie(guestId: string, expiresAt: number): Promise<void> {
  const secret = proSecretFromEnv();
  if (!secret) throw new Error("No PRO_COOKIE_SECRET or STRIPE_SECRET_KEY to sign the Pro cookie");
  (await cookies()).set(PRO_COOKIE, signProToken(guestId, expiresAt, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  });
}
