import { connection } from "next/server";
import { getGuestId } from "@/lib/guest";
import { grantProCookie, verifyCheckoutForGuest } from "@/lib/pro";
import { getOrigin } from "@/lib/stripe";

/**
 * GET /api/pro/claim?session_id=cs_...: asks Stripe about the Checkout Session; if it is complete, paid and
 * was started by this browser's guest, sets the signed httpOnly `ots_pro` cookie. Then redirects to
 * /checkout/success?ok=1, or ?error=<reason>. The query param alone never grants anything.
 */
export async function GET(req: Request) {
  await connection();
  const origin = getOrigin(req);
  const back = (params: Record<string, string>) =>
    Response.redirect(`${origin}/checkout/success?${new URLSearchParams(params).toString()}`, 303);

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return back({ error: "Missing checkout session." });

  try {
    const result = await verifyCheckoutForGuest(sessionId, await getGuestId());
    if (!result.ok) return back({ error: result.reason });
    await grantProCookie(result.guestId, result.expiresAt);
    return back({ ok: "1" });
  } catch (err) {
    console.error("GET /api/pro/claim failed:", err instanceof Error ? err.message : err);
    return back({ error: "We couldn't confirm the payment. Please try again." });
  }
}
