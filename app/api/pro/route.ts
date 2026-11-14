import { connection } from "next/server";
import { isProRequest } from "@/lib/pro";

/** GET /api/pro: { pro } for this browser (verified signed cookie). Any failure answers { pro: false }. */
export async function GET() {
  // Per-request answer: never prerender it.
  await connection();
  return Response.json({ pro: await isProRequest() }, { headers: { "cache-control": "no-store" } });
}
