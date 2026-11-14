import { ttsHandler } from "@/lib/speech/handlers";
import { speech } from "@/lib/speech/server";

let handler: ReturnType<typeof ttsHandler> | null = null;

/** POST /api/speech/tts `{ text, token? }` → audio/mpeg or `{ code }`. See lib/speech/handlers.ts. */
export async function POST(request: Request) {
  handler ??= ttsHandler(speech());
  return handler(request);
}
