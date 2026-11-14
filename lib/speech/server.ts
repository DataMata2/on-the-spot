// Process singletons for the speech routes (kept on globalThis so dev hot reloads don't reset the day's budget).
import "server-only";
import { getGuestId } from "@/lib/guest";
import { takeSpeechBudget } from "@/lib/limits";
import { proSecretFromEnv } from "@/lib/pro-token";
import { SpeechBudget } from "@/lib/speech-budget";
import { speechConfigFromEnv } from "./config";
import { CreditGuard } from "./credits";
import { elevenCreditsRemaining } from "./elevenlabs";
import type { SpeechDeps } from "./handlers";
import { staticTtsTexts, ttsSecretFromEnv, TtsSigner } from "./tts-allow";
import { TtsCache } from "./tts-cache";

function build(): SpeechDeps {
  const config = speechConfigFromEnv();
  const budget = new SpeechBudget({ ttsCharsPerDay: config.dailyTtsChars, sttSecondsPerDay: config.dailySttSeconds, file: config.enabled ? config.budgetFile : null });
  return {
    config,
    budget,
    credits: new CreditGuard({
      fetchBalance: () => (config.apiKey ? elevenCreditsRemaining(config.apiKey) : Promise.reject(new Error("no key"))),
      localBalance: () => config.startCredits - budget.creditsUsed(),
      reserveUntil: config.reserveUntil,
      reserveCredits: config.reserveCredits,
      floorCredits: config.floorCredits,
      ttsFloorCredits: config.ttsFloorCredits,
    }),
    cache: new TtsCache(config.enabled ? config.cacheDir : null),
    signer: new TtsSigner(ttsSecretFromEnv(process.env, proSecretFromEnv())),
    allowedTexts: staticTtsTexts(),
    rateLimit: async (request) => takeSpeechBudget(request, await getGuestId()),
    prewarmSecret: process.env.TTS_PREWARM_SECRET ?? null,
  };
}

const g = globalThis as unknown as { __speechDeps?: SpeechDeps };

export function speech(): SpeechDeps {
  return (g.__speechDeps ??= build());
}

/** HMAC token that lets the client ask POST /api/speech/tts for this server-produced text. */
export function ttsToken(text: string): string {
  return speech().signer.sign(text);
}
