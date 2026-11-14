// Route logic for /api/speech/* with every dependency injected, so the error mapping is unit-tested without Next.
// lib/speech/server.ts wires the real singletons; app/api/speech/*/route.ts are thin wrappers.
//
// Every failure answers a typed `{ code }` the client treats the same way: fall back to the browser's speech,
// silently. Nothing here logs the API key or a full text.
import { timingSafeEqual } from "node:crypto";
import type { SpeechBudget, SpeechKind } from "@/lib/speech-budget";
import { sttCredits, STT_MAX_BYTES, STT_MAX_SECONDS, ttsCredits, type SpeechConfig } from "./config";
import type { CreditGuard, CreditHold } from "./credits";
import { elevenStt, elevenTts, type FetchLike } from "./elevenlabs";
import { isPrewarmSet, PREWARM_MAX_CHARS, prewarmTexts } from "./prewarm";
import { checkTtsText, type TtsSigner } from "./tts-allow";
import { ttsCacheKey, type TtsCache } from "./tts-cache";

export interface SpeechDeps {
  config: SpeechConfig;
  budget: SpeechBudget;
  credits: CreditGuard;
  cache: TtsCache;
  signer: TtsSigner;
  allowedTexts: ReadonlySet<string>;
  /** Per guest / IP / global request budget for speech calls; false = over it. */
  rateLimit(request: Request): Promise<boolean>;
  fetchImpl?: FetchLike;
  /** Secret for POST /api/speech/prewarm; the route is off (404) without it. */
  prewarmSecret?: string | null;
}

export type SttErrorCode = "unavailable" | "budget" | "too_long" | "failed";
export type TtsErrorCode = "unavailable" | "budget" | "not_allowed" | "too_long" | "failed";

const NO_STORE = { "cache-control": "no-store" };
const errorJson = (status: number, code: string) => Response.json({ code }, { status, headers: NO_STORE });

/** Lower bound on audio length from its size: no browser encoder records speech above ~192 kbps. */
const MAX_BYTES_PER_SECOND = 24_000;

const AUDIO_TYPES = /^(audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|wave|aac|x-m4a|m4a|mp4a-latm|flac)|video\/(webm|mp4))(;.*)?$/i;

function log(kind: SpeechKind, amount: number, deps: SpeechDeps, extra = "") {
  const d = deps.budget.today();
  const unit = kind === "tts" ? "chars" : "seconds";
  console.log(`[elevenlabs] ${kind} ${unit}=${amount}${extra} day=${d.day} total=${d[kind]}/${deps.budget.caps[kind]} credits_used=${deps.budget.creditsUsed()}`);
}

/**
 * Hold the estimated cost of a call against the credit floor AND the daily cap, in one synchronous step (no await
 * between the check and the hold, so parallel calls can't both pass a check that only one fits). Refreshes the
 * cached balance first. Returns the hold, or the error code when either guard refuses (nothing held then).
 */
async function reserve(deps: SpeechDeps, kind: SpeechKind, amount: number, credits: number): Promise<CreditHold | "unavailable" | "budget"> {
  await deps.credits.refresh();
  // Synchronous from here to the return: check-and-hold is atomic on the event loop.
  const hold = deps.credits.tryReserve(kind, credits);
  if (!hold) return "unavailable";
  if (!deps.budget.take(kind, amount)) {
    hold.release();
    return "budget";
  }
  return hold;
}

/** Settle a hold to the actual cost: against the cached live balance and in the persisted local total. */
function settleCredits(deps: SpeechDeps, hold: CreditHold, credits: number) {
  hold.settle(credits);
  deps.budget.addCredits(credits);
}

/** Is ElevenLabs usable for `kind` right now (key set, daily cap not reached, balance above the floor)? */
export async function providerAvailable(deps: SpeechDeps, kind: SpeechKind, credits = 0): Promise<boolean> {
  if (!deps.config.enabled || !deps.config.apiKey) return false;
  if (deps.budget.exhausted(kind)) return false;
  return deps.credits.allows(kind, credits);
}

/** GET /api/speech/config → `{ stt, tts }`: "elevenlabs" when the server will try it, else "browser". */
export function configHandler(deps: SpeechDeps) {
  return async () => {
    const [stt, tts] = await Promise.all([providerAvailable(deps, "stt"), providerAvailable(deps, "tts")]);
    return Response.json({ stt: stt ? "elevenlabs" : "browser", tts: tts ? "elevenlabs" : "browser" }, { headers: NO_STORE });
  };
}

/** Reads at most `max` bytes of the body; null when it is bigger. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      // Stop reading; the rest of the body is dropped with the request (no cancel: some body sources throw on it).
      reader.releaseLock();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return all;
}

const extFor = (type: string) => (/mp4|m4a|aac/i.test(type) ? "mp4" : /ogg/i.test(type) ? "ogg" : /mpeg|mp3/i.test(type) ? "mp3" : /wav/i.test(type) ? "wav" : "webm");

/**
 * POST /api/speech/stt: multipart (`audio` file + `durationMs`) or a raw audio body (`x-audio-duration-ms` header).
 * → `{ text }`, or `{ code }`: unavailable (no key, rate limit, balance reserve), budget (daily cap), too_long
 * (> 1.5 MB or > 47 s), failed (bad audio, ElevenLabs error or timeout).
 */
export function sttHandler(deps: SpeechDeps) {
  return async (request: Request): Promise<Response> => {
    if (!deps.config.enabled || !deps.config.apiKey) return errorJson(503, "unavailable");
    if (!(await deps.rateLimit(request))) return errorJson(429, "unavailable");

    // Multipart framing adds a little; the audio itself is checked against the cap below.
    const raw = await readCapped(request, STT_MAX_BYTES + 16 * 1024);
    if (!raw) return errorJson(413, "too_long");
    const contentType = request.headers.get("content-type") ?? "";
    let audio: Blob;
    let clientMs = Number(request.headers.get("x-audio-duration-ms"));
    if (/^multipart\/form-data/i.test(contentType)) {
      let form: FormData;
      try {
        form = await new Response(raw as BodyInit, { headers: { "content-type": contentType } }).formData();
      } catch {
        return errorJson(400, "failed");
      }
      const file = form.get("audio");
      if (!(file instanceof Blob)) return errorJson(400, "failed");
      audio = file;
      const d = Number(form.get("durationMs"));
      if (Number.isFinite(d)) clientMs = d;
    } else {
      audio = new Blob([raw as BlobPart], { type: contentType });
    }
    const type = audio.type || contentType;
    if (!AUDIO_TYPES.test(type)) return errorJson(415, "failed");
    if (audio.size > STT_MAX_BYTES) return errorJson(413, "too_long");
    if (audio.size < 500) return errorJson(400, "failed");

    const clientSecs = Number.isFinite(clientMs) && clientMs > 0 ? clientMs / 1000 : 0;
    const estimate = Math.max(clientSecs, audio.size / MAX_BYTES_PER_SECOND, 1);
    if (estimate > STT_MAX_SECONDS) return errorJson(413, "too_long");
    const reserved = Math.ceil(estimate);
    const hold = await reserve(deps, "stt", reserved, sttCredits(reserved));
    if (hold === "unavailable") return errorJson(503, "unavailable");
    if (hold === "budget") return errorJson(429, "budget");

    try {
      const result = await elevenStt({
        apiKey: deps.config.apiKey,
        modelId: deps.config.sttModel,
        audio,
        filename: `answer.${extFor(type)}`,
        fetchImpl: deps.fetchImpl,
      });
      const actual = result.durationSecs ?? reserved;
      deps.budget.record("stt", actual - reserved);
      settleCredits(deps, hold, sttCredits(actual));
      log("stt", Math.round(actual * 10) / 10, deps);
      return Response.json({ text: result.text }, { headers: NO_STORE });
    } catch (err) {
      deps.budget.refund("stt", reserved);
      hold.release();
      console.warn("[elevenlabs] stt failed:", err instanceof Error ? err.message : "error");
      return errorJson(502, "failed");
    }
  };
}

/** Generates (or reuses) the audio for an allowed text. Concurrent requests for one text share one API call. */
function ttsGenerator(deps: SpeechDeps) {
  const inflight = new Map<string, Promise<Uint8Array | TtsErrorCode>>();
  return async (text: string): Promise<{ audio: Uint8Array; hit: boolean } | TtsErrorCode> => {
    const { voiceId, ttsModel, ttsFormat, apiKey } = deps.config;
    const key = ttsCacheKey(voiceId, ttsModel, ttsFormat, text);
    const cached = await deps.cache.get(key);
    if (cached) return { audio: cached, hit: true };
    if (!apiKey) return "unavailable";
    let job = inflight.get(key);
    if (!job) {
      job = (async (): Promise<Uint8Array | TtsErrorCode> => {
        const credits = ttsCredits(ttsModel, text.length);
        const hold = await reserve(deps, "tts", text.length, credits);
        if (typeof hold === "string") return hold;
        try {
          const audio = await elevenTts({ apiKey, voiceId, modelId: ttsModel, format: ttsFormat, text, fetchImpl: deps.fetchImpl });
          settleCredits(deps, hold, credits);
          log("tts", text.length, deps);
          await deps.cache.set(key, audio);
          return audio;
        } catch (err) {
          deps.budget.refund("tts", text.length);
          hold.release();
          console.warn("[elevenlabs] tts failed:", err instanceof Error ? err.message : "error");
          return "failed";
        }
      })().finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    const out = await job;
    return typeof out === "string" ? out : { audio: out, hit: false };
  };
}

const TTS_STATUS: Record<TtsErrorCode, number> = { unavailable: 503, budget: 429, not_allowed: 403, too_long: 413, failed: 502 };

/**
 * POST /api/speech/tts `{ text, token? }` → audio/mpeg. Only allowed texts (see tts-allow.ts). A cache hit is free:
 * no API call, no budget, no rate limit. Errors: `{ code }` (TtsErrorCode).
 */
export function ttsHandler(deps: SpeechDeps) {
  const generate = ttsGenerator(deps);
  return async (request: Request): Promise<Response> => {
    if (!deps.config.enabled) return errorJson(503, "unavailable");
    const raw = await readCapped(request, 8 * 1024);
    if (!raw) return errorJson(413, "too_long");
    let body: { text?: unknown; token?: unknown };
    try {
      body = JSON.parse(new TextDecoder().decode(raw)) as typeof body;
    } catch {
      return errorJson(400, "failed");
    }
    if (typeof body !== "object" || body === null) return errorJson(400, "failed");
    const check = checkTtsText(body.text, body.token, deps.signer, deps.allowedTexts);
    if (!check.ok) return errorJson(check.reason === "too_long" ? 413 : check.reason === "empty" ? 400 : 403, check.reason === "empty" ? "failed" : check.reason);

    const { voiceId, ttsModel, ttsFormat } = deps.config;
    const cached = await deps.cache.get(ttsCacheKey(voiceId, ttsModel, ttsFormat, check.text));
    if (!cached && !(await deps.rateLimit(request))) return errorJson(429, "unavailable");
    const out = cached ? { audio: cached, hit: true } : await generate(check.text);
    if (typeof out === "string") return errorJson(TTS_STATUS[out], out);
    return new Response(out.audio as BodyInit, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400", "x-tts-cache": out.hit ? "hit" : "miss" },
    });
  };
}

function secretMatches(given: string | null, secret: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/speech/prewarm (header `authorization: Bearer $TTS_PREWARM_SECRET`; 404 when the secret is unset).
 * `?dryRun=1` lists the texts and their character total without calling ElevenLabs. `?set=roles` does the drill 1
 * role banks instead of the core set (see prewarm.ts). Refuses (400) when the set's texts add up to more than
 * PREWARM_MAX_CHARS. Already cached texts cost nothing.
 */
export function prewarmHandler(deps: SpeechDeps) {
  const generate = ttsGenerator(deps);
  return async (request: Request): Promise<Response> => {
    const secret = deps.prewarmSecret?.trim();
    if (!secret) return new Response("Not found", { status: 404 });
    const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    if (!secretMatches(auth, secret)) return new Response("Not found", { status: 404 });

    const setParam = new URL(request.url).searchParams.get("set");
    if (setParam !== null && !isPrewarmSet(setParam)) return Response.json({ error: "unknown set" }, { status: 400, headers: NO_STORE });
    const texts = prewarmTexts(setParam ?? "core");
    const totalChars = texts.reduce((n, t) => n + t.length, 0);
    const { voiceId, ttsModel, ttsFormat } = deps.config;
    const estCredits = ttsCredits(ttsModel, totalChars);
    if (totalChars > PREWARM_MAX_CHARS) {
      return Response.json({ error: `refusing: ${totalChars} chars > ${PREWARM_MAX_CHARS}`, totalChars, estCredits }, { status: 400, headers: NO_STORE });
    }
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const items: { chars: number; status: "hit" | "generated" | TtsErrorCode | "listed"; preview: string }[] = [];
    let newChars = 0;
    for (const text of texts) {
      const preview = text.slice(0, 40);
      if (dryRun) {
        const hit = await deps.cache.get(ttsCacheKey(voiceId, ttsModel, ttsFormat, text));
        if (!hit) newChars += text.length;
        items.push({ chars: text.length, status: hit ? "hit" : "listed", preview });
        continue;
      }
      if (!deps.config.enabled) {
        items.push({ chars: text.length, status: "unavailable", preview });
        continue;
      }
      const out = await generate(text);
      if (typeof out !== "string" && !out.hit) newChars += text.length;
      items.push({ chars: text.length, status: typeof out === "string" ? out : out.hit ? "hit" : "generated", preview });
    }
    return Response.json({ dryRun, totalChars, estCredits, newChars, newCredits: ttsCredits(ttsModel, newChars), items }, { headers: NO_STORE });
  };
}
