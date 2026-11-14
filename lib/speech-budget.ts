// Daily (UTC) server-side caps on ElevenLabs spend: TTS characters and STT seconds. Counted in memory and
// mirrored to a small JSON file (next to the TTS cache) so a restart doesn't reset the day. Over a cap, that
// provider is "unavailable" and the client silently falls back to the browser's speech. The file also keeps the
// all-time ElevenLabs credits spent (never reset): the base of the local balance estimate when the API key can't
// read the subscription (lib/speech/credits.ts). Pure apart from node:fs and the injectable clock; no Next
// imports, so it is unit-tested directly.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { utcDay } from "@/lib/limits-core";

export type SpeechKind = "tts" | "stt";

export const DEFAULT_DAILY_TTS_CHARS = 3000;
export const DEFAULT_DAILY_STT_SECONDS = 600;

interface DayUsage {
  day: string;
  tts: number;
  stt: number;
}

interface Stored extends DayUsage {
  /** Estimated ElevenLabs credits spent since the file was created (all days). */
  credits: number;
}

export interface SpeechBudgetOptions {
  ttsCharsPerDay: number;
  sttSecondsPerDay: number;
  /** JSON file the counters are mirrored to; null keeps them in memory only. */
  file?: string | null;
  now?: () => number;
}

/** A positive integer from env, else the fallback. */
export function capFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export class SpeechBudget {
  private usage: DayUsage;
  private credits = 0;
  private readonly now: () => number;
  private readonly file: string | null;
  readonly caps: Record<SpeechKind, number>;

  constructor(opts: SpeechBudgetOptions) {
    this.now = opts.now ?? Date.now;
    this.file = opts.file ?? null;
    this.caps = { tts: opts.ttsCharsPerDay, stt: opts.sttSecondsPerDay };
    const stored = this.load();
    this.credits = stored?.credits ?? 0;
    this.usage = stored && stored.day === utcDay(this.now()) ? { day: stored.day, tts: stored.tts, stt: stored.stt } : { day: utcDay(this.now()), tts: 0, stt: 0 };
  }

  /** Today's counters (rolled over to zero on a new UTC day). */
  today(): DayUsage {
    const day = utcDay(this.now());
    if (this.usage.day !== day) this.usage = { day, tts: 0, stt: 0 };
    return { ...this.usage };
  }

  /** Has this provider reached its cap for today? */
  exhausted(kind: SpeechKind): boolean {
    return this.today()[kind] >= this.caps[kind];
  }

  /** Would `amount` more fit under today's cap? Counts nothing. */
  allows(kind: SpeechKind, amount: number): boolean {
    return this.today()[kind] + Math.max(0, amount) <= this.caps[kind];
  }

  /** Reserve `amount` for a call about to be made; false (nothing counted) when it would pass the cap. */
  take(kind: SpeechKind, amount: number): boolean {
    if (!this.allows(kind, amount)) return false;
    this.record(kind, amount);
    return true;
  }

  /** Add (or, negative, give back) usage; never below zero. Returns today's running total for `kind`. */
  record(kind: SpeechKind, amount: number): number {
    this.today();
    this.usage[kind] = Math.max(0, Math.round((this.usage[kind] + amount) * 10) / 10);
    this.save();
    return this.usage[kind];
  }

  /** All-time estimated credits spent (persisted; survives day rollover and restarts). */
  creditsUsed(): number {
    return this.credits;
  }

  /** Count credits an ElevenLabs call just spent. */
  addCredits(amount: number): void {
    this.credits = Math.round((this.credits + Math.max(0, amount)) * 10) / 10;
    this.save();
  }

  /** Give back a reservation for a call that failed. */
  refund(kind: SpeechKind, amount: number): void {
    this.record(kind, -Math.max(0, amount));
  }

  private load(): Stored | null {
    if (!this.file) return null;
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Stored>;
      if (typeof raw.day !== "string") return null;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
      return { day: raw.day, tts: num(raw.tts), stt: num(raw.stt), credits: num(raw.credits) };
    } catch {
      return null;
    }
  }

  private save(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...this.usage, credits: this.credits }));
      renameSync(tmp, this.file);
    } catch {
      // A read-only or missing disk keeps the in-memory counters working.
    }
  }
}
