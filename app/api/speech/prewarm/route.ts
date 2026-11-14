import { prewarmHandler } from "@/lib/speech/handlers";
import { speech } from "@/lib/speech/server";

let handler: ReturnType<typeof prewarmHandler> | null = null;

/** POST /api/speech/prewarm (Bearer TTS_PREWARM_SECRET; 404 without it): pre-generates the jury's TTS audio. */
export async function POST(request: Request) {
  handler ??= prewarmHandler(speech());
  return handler(request);
}
