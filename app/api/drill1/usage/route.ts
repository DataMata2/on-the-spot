import { getOrCreateGuestId } from "@/lib/guest";
import { drillUsage } from "@/lib/limits";
import { isProRequest } from "@/lib/pro";

/** GET /api/drill1/usage → `{ usage: { usedToday, freePerDay, drill2FreeUsed }, pro }` for the progress card. */
export async function GET() {
  const guestId = await getOrCreateGuestId();
  const pro = await isProRequest();
  return Response.json({ usage: drillUsage(guestId, pro), pro }, { headers: { "cache-control": "no-store" } });
}
