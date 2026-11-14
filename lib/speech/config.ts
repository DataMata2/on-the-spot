// ElevenLabs settings from env. Without ELEVENLABS_API_KEY the provider is off and the app uses the browser's
// speech (Web Speech API + speechSynthesis) exactly as before. Pure; unit-tested.
import { join, resolve } from "node:path";
import { capFromEnv, DEFAULT_DAILY_STT_SECONDS, DEFAULT_DAILY_TTS_CHARS } from "@/lib/speech-budget";

/** Scribe v3: ElevenLabs' batch speech-to-text model for recorded audio (successor to scribe_v2). */
export const DEFAULT_STT_MODEL = "scribe_v3";
/** Flash v2.5: ~75-100 ms model latency, half the credits per character of the standard models on the API. */
export const DEFAULT_TTS_MODEL = "eleven_flash_v2_5";
/** 44.1 kHz mono MP3 at 64 kbps: small, plays everywhere, allowed on the free tier. */
export const DEFAULT_TTS_FORMAT = "mp3_44100_64";
/**
 * "Eric" (American, smooth, middle-aged male), an ElevenLabs Default voice. Free accounts can't use Voice Library
 * voices over the API (402 paid_plan_required), so not its library replacement "Eddie" (l7kNoIfnJKPg7779LI2t).
 * Default voices expire on 2026-12-31. Override with ELEVENLABS_VOICE_ID.
 */
export const DEFAULT_VOICE_ID = "cjVigY5qzO86Huf0OWal";

/** Longest recording the server transcribes (the client stops at 45 s; 2 s of slack). */
export const STT_MAX_SECONDS = 47;
/** Largest audio upload (bytes). 45 s of 32 kbps Opus is ~180 KB; this leaves room for other encoders. */
export const STT_MAX_BYTES = 1.5 * 1024 * 1024;
/** Longest text the server speaks (characters). */
export const TTS_MAX_CHARS = 600;
/** Abort an ElevenLabs call after this long. */
export const ELEVEN_TIMEOUT_MS = 15_000;

/** Start of the jury window (12:00 Almaty): until then, keep ELEVENLABS_RESERVE_CREDITS untouched. */
export const DEFAULT_RESERVE_UNTIL = "2026-11-15T07:00:00Z";
export const DEFAULT_RESERVE_CREDITS = 3000;
/** The plan's credits when the key can't read the subscription: the local balance is this minus logged usage. */
export const DEFAULT_START_CREDITS = 10_000;
/** After the reserve window, STT may spend the balance down to this floor... */
export const DEFAULT_FLOOR_CREDITS = 200;
/** ...and TTS (cache misses only) stops at this higher floor, so the last credits go to speech-to-text. */
export const DEFAULT_TTS_FLOOR_CREDITS = 1000;
/** Scribe speech-to-text costs 330 credits per minute of audio (elevenlabs.io/pricing). */
export const STT_CREDITS_PER_SECOND = 330 / 60;

/** Credits one TTS call of `chars` characters costs: Flash/Turbo models are 0.5 credit per character on the API. */
export function ttsCredits(modelId: string, chars: number): number {
  return chars * (/flash|turbo/i.test(modelId) ? 0.5 : 1);
}

/** Credits for `seconds` of transcribed audio. */
export function sttCredits(seconds: number): number {
  return seconds * STT_CREDITS_PER_SECOND;
}

export interface SpeechConfig {
  enabled: boolean;
  apiKey: string | null;
  voiceId: string;
  ttsModel: string;
  sttModel: string;
  ttsFormat: string;
  cacheDir: string;
  budgetFile: string;
  dailyTtsChars: number;
  dailySttSeconds: number;
  /** ms since epoch; NaN-safe (an unparsable env value falls back to the default). */
  reserveUntil: number;
  reserveCredits: number;
  startCredits: number;
  floorCredits: number;
  ttsFloorCredits: number;
}

export function speechConfigFromEnv(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): SpeechConfig {
  const apiKey = env.ELEVENLABS_API_KEY?.trim() || null;
  const cacheDir = resolve(cwd, env.TTS_CACHE_DIR?.trim() || join(".cache", "tts"));
  return {
    enabled: Boolean(apiKey),
    apiKey,
    voiceId: env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID,
    ttsModel: env.ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    sttModel: env.ELEVENLABS_STT_MODEL?.trim() || DEFAULT_STT_MODEL,
    ttsFormat: DEFAULT_TTS_FORMAT,
    cacheDir,
    budgetFile: join(cacheDir, "..", "speech-budget.json"),
    dailyTtsChars: capFromEnv(env.ELEVENLABS_DAILY_TTS_CHARS, DEFAULT_DAILY_TTS_CHARS),
    dailySttSeconds: capFromEnv(env.ELEVENLABS_DAILY_STT_SECONDS, DEFAULT_DAILY_STT_SECONDS),
    reserveUntil: dateFromEnv(env.ELEVENLABS_RESERVE_UNTIL, DEFAULT_RESERVE_UNTIL),
    reserveCredits: capFromEnv(env.ELEVENLABS_RESERVE_CREDITS, DEFAULT_RESERVE_CREDITS),
    startCredits: capFromEnv(env.ELEVENLABS_START_CREDITS, DEFAULT_START_CREDITS),
    floorCredits: capFromEnv(env.ELEVENLABS_FLOOR_CREDITS, DEFAULT_FLOOR_CREDITS),
    ttsFloorCredits: capFromEnv(env.ELEVENLABS_TTS_FLOOR_CREDITS, DEFAULT_TTS_FLOOR_CREDITS),
  };
}

function dateFromEnv(value: string | undefined, fallback: string): number {
  const t = value?.trim() ? Date.parse(value.trim()) : NaN;
  return Number.isFinite(t) ? t : Date.parse(fallback);
}
