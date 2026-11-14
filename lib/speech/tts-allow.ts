// Which texts POST /api/speech/tts may speak: only texts the server can vouch for, so the route never becomes a
// free TTS proxy. Static texts (the drill 1 question banks: general and per role; drill 2 opening lines) are allowed as they are; texts the
// server produces at runtime (drill 2 manager replies, rehearse and "other" role questions) carry an HMAC token the server issues
// next to them. Pure (node:crypto only); unit-tested.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { QUESTIONS } from "@/lib/drill1/questions";
import { ROLE_QUESTIONS } from "@/lib/drill1/roles";
import { SCENARIOS } from "@/lib/drill2/scenarios";
import { TTS_MAX_CHARS } from "./config";

/** Whitespace-collapsed, trimmed text: what is signed, cached and spoken. */
export function normalizeTtsText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Texts that are always allowed: they are in the code. */
export function staticTtsTexts(): Set<string> {
  return new Set([...QUESTIONS.map((q) => q.text), ...ROLE_QUESTIONS.map((q) => q.text), ...SCENARIOS.map((s) => s.managerLine)].map(normalizeTtsText));
}

export class TtsSigner {
  constructor(private readonly secret: string) {}

  sign(text: string): string {
    return createHmac("sha256", this.secret).update(`tts:v1:${normalizeTtsText(text)}`).digest("base64url").slice(0, 32);
  }

  verify(text: string, token: unknown): boolean {
    if (typeof token !== "string" || token.length !== 32) return false;
    const expected = Buffer.from(this.sign(text));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

/** TTS_TOKEN_SECRET, else derived from the Pro cookie secret, else random for this process (tokens die on restart). */
export function ttsSecretFromEnv(env: Record<string, string | undefined>, proSecret: string | null): string {
  const explicit = env.TTS_TOKEN_SECRET?.trim();
  if (explicit) return explicit;
  if (proSecret) return createHash("sha256").update(`tts-token:${proSecret}`).digest("hex");
  return randomBytes(32).toString("hex");
}

export type TtsCheck = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" | "not_allowed" };

/** Is this text (with its optional token) one the server will speak? */
export function checkTtsText(rawText: unknown, token: unknown, signer: TtsSigner, allowed: ReadonlySet<string>): TtsCheck {
  const text = normalizeTtsText(rawText);
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > TTS_MAX_CHARS) return { ok: false, reason: "too_long" };
  if (allowed.has(text) || signer.verify(text, token)) return { ok: true, text };
  return { ok: false, reason: "not_allowed" };
}
