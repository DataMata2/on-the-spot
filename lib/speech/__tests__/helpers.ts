// Test wiring for lib/speech/handlers.ts: in-memory budget, fixed balance, a mocked fetch. No real API calls.
import { vi } from "vitest";
import { SpeechBudget } from "@/lib/speech-budget";
import { speechConfigFromEnv } from "../config";
import { CreditGuard } from "../credits";
import type { SpeechDeps } from "../handlers";
import { staticTtsTexts, TtsSigner } from "../tts-allow";
import { TtsCache } from "../tts-cache";

export const NOW = Date.parse("2026-11-15T09:00:00Z"); // after the default reserve window

export function makeDeps(over: { key?: string | null; fetchImpl?: SpeechDeps["fetchImpl"]; tts?: number; stt?: number; balance?: number | null; now?: number; rateOk?: boolean; cacheDir?: string | null; prewarmSecret?: string } = {}) {
  const now = over.now ?? NOW;
  const env: Record<string, string | undefined> = { ELEVENLABS_API_KEY: over.key === undefined ? "test-key" : (over.key ?? undefined) };
  const config = speechConfigFromEnv(env, "/tmp");
  const fetchBalance = vi.fn(async () => {
    if (over.balance === null) throw new Error("no permission");
    return over.balance ?? 9000;
  });
  const deps: SpeechDeps = {
    config,
    budget: new SpeechBudget({ ttsCharsPerDay: over.tts ?? 3000, sttSecondsPerDay: over.stt ?? 600, now: () => now }),
    credits: new CreditGuard({ fetchBalance, reserveUntil: config.reserveUntil, reserveCredits: config.reserveCredits, floorCredits: config.floorCredits, ttsFloorCredits: config.ttsFloorCredits, now: () => now }),
    cache: new TtsCache(over.cacheDir ?? null),
    signer: new TtsSigner("test-secret"),
    allowedTexts: staticTtsTexts(),
    rateLimit: async () => over.rateOk ?? true,
    fetchImpl: over.fetchImpl,
    prewarmSecret: over.prewarmSecret ?? null,
  };
  return { deps, fetchBalance };
}

export const mp3 = () => new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x44, 1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });

export function audioRequest(bytes: number, durationMs: number, type = "audio/webm") {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(bytes)], { type }), "answer.webm");
  form.append("durationMs", String(durationMs));
  return new Request("http://localhost/api/speech/stt", { method: "POST", body: form });
}

export function ttsRequest(body: unknown) {
  return new Request("http://localhost/api/speech/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
