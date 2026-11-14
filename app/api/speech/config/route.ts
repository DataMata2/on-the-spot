import { connection } from "next/server";
import { configHandler } from "@/lib/speech/handlers";
import { speech } from "@/lib/speech/server";

/** GET /api/speech/config → `{ stt, tts }`, each "elevenlabs" or "browser". */
export async function GET() {
  await connection();
  return configHandler(speech())();
}
