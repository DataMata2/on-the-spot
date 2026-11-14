import { sttHandler } from "@/lib/speech/handlers";
import { speech } from "@/lib/speech/server";

let handler: ReturnType<typeof sttHandler> | null = null;

/** POST /api/speech/stt: audio → `{ text }` or `{ code }`. See lib/speech/handlers.ts. */
export async function POST(request: Request) {
  handler ??= sttHandler(speech());
  return handler(request);
}
