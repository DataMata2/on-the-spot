// Thin ElevenLabs REST client (fetch only, injectable for tests). The API key goes in the `xi-api-key` header and
// is never logged; errors carry the HTTP status only.
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
//       https://elevenlabs.io/docs/api-reference/speech-to-text/convert
//       https://elevenlabs.io/docs/api-reference/user/subscription/get
import { ELEVEN_TIMEOUT_MS } from "./config";

export const ELEVEN_BASE = "https://api.elevenlabs.io";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ElevenError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ElevenError";
  }
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

async function call(fetchImpl: FetchLike, url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new ElevenError(0, `${what}: ${name === "TimeoutError" || name === "AbortError" ? "timed out" : "network error"}`);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new ElevenError(res.status, `${what}: HTTP ${res.status}`);
  }
  return res;
}

export interface TtsRequest {
  apiKey: string;
  voiceId: string;
  modelId: string;
  format: string;
  text: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** POST /v1/text-to-speech/{voice_id}?output_format=… → the audio bytes. */
export async function elevenTts(r: TtsRequest): Promise<Uint8Array> {
  const url = `${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(r.voiceId)}?output_format=${encodeURIComponent(r.format)}`;
  const res = await call(
    r.fetchImpl ?? fetch,
    url,
    {
      method: "POST",
      headers: { "xi-api-key": r.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: r.text, model_id: r.modelId, language_code: "en" }),
      signal: withTimeout(r.signal, r.timeoutMs ?? ELEVEN_TIMEOUT_MS),
    },
    "tts",
  );
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new ElevenError(502, "tts: empty audio");
  return bytes;
}

export interface SttRequest {
  apiKey: string;
  modelId: string;
  audio: Blob;
  filename: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SttResult {
  text: string;
  /** Seconds of audio ElevenLabs transcribed (null when the response omits it). */
  durationSecs: number | null;
}

/** POST /v1/speech-to-text (multipart: model_id, file, language_code=en) → `{ text, audio_duration_secs }`. */
export async function elevenStt(r: SttRequest): Promise<SttResult> {
  const form = new FormData();
  form.append("model_id", r.modelId);
  form.append("language_code", "en");
  form.append("tag_audio_events", "false");
  form.append("timestamps_granularity", "none");
  form.append("file", r.audio, r.filename);
  const res = await call(
    r.fetchImpl ?? fetch,
    `${ELEVEN_BASE}/v1/speech-to-text`,
    { method: "POST", headers: { "xi-api-key": r.apiKey }, body: form, signal: withTimeout(r.signal, r.timeoutMs ?? ELEVEN_TIMEOUT_MS) },
    "stt",
  );
  let body: { text?: unknown; audio_duration_secs?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new ElevenError(502, "stt: response is not JSON");
  }
  if (typeof body.text !== "string") throw new ElevenError(502, "stt: no text in response");
  const d = body.audio_duration_secs;
  return { text: body.text.trim(), durationSecs: typeof d === "number" && Number.isFinite(d) && d >= 0 ? d : null };
}

/** GET /v1/user/subscription → credits left this billing period (character_limit - character_count). */
export async function elevenCreditsRemaining(apiKey: string, fetchImpl: FetchLike = fetch, timeoutMs = 8_000): Promise<number> {
  const res = await call(fetchImpl, `${ELEVEN_BASE}/v1/user/subscription`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(timeoutMs) }, "subscription");
  const body = (await res.json().catch(() => ({}))) as { character_count?: unknown; character_limit?: unknown };
  const used = Number(body.character_count);
  const limit = Number(body.character_limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit)) throw new ElevenError(502, "subscription: no credit fields");
  return Math.max(0, limit - used);
}
