// Reserve guard on the live ElevenLabs balance (GET /v1/user/subscription, cached ~5 min). Until `reserveUntil`
// (the start of the jury window) nothing may spend the balance below `reserveCredits`; after it, STT may spend down
// to `floorCredits` and TTS only down to `ttsFloorCredits` (STT has priority). Spending between two balance reads is
// subtracted locally, so the guard reacts before the next read. When the key can't read the subscription (a key
// scoped to TTS + STT gets 401 missing_permissions user_read), the balance is the local estimate instead:
// ELEVENLABS_START_CREDITS minus the credits logged in the budget file. With both, the lower one counts.
// Pure apart from the injected functions.
import type { SpeechKind } from "@/lib/speech-budget";

export const BALANCE_TTL_MS = 5 * 60 * 1000;
/** After a failed read, wait this long before trying again. */
export const BALANCE_RETRY_MS = 10 * 60 * 1000;

export interface CreditGuardOptions {
  /** Credits left in the billing period; throws when it can't be read. */
  fetchBalance(): Promise<number>;
  /** The local estimate used while the live balance can't be read (null = no estimate). */
  localBalance?: () => number | null;
  reserveUntil: number;
  reserveCredits: number;
  floorCredits: number;
  ttsFloorCredits: number;
  now?: () => number;
  ttlMs?: number;
}

export class CreditGuard {
  private balance: number | null = null;
  private readAt = -Infinity;
  private failedAt = -Infinity;
  private inflight: Promise<number | null> | null = null;
  private warned = false;
  private readonly now: () => number;

  constructor(private readonly opts: CreditGuardOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** Where the last answer of remaining() came from. */
  source: "live" | "local" | "none" = "none";

  /**
   * The balance: the lower of the live value (cached) and the local estimate, whichever exists; null when neither.
   * The lower one, because ElevenLabs' character_count can lag behind calls just made.
   */
  async remaining(): Promise<number | null> {
    const live = await this.liveBalance();
    const raw = this.opts.localBalance?.() ?? null;
    const local = raw === null ? null : Math.max(0, raw);
    if (live !== null && (local === null || live <= local)) {
      this.source = "live";
      return live;
    }
    this.source = local === null ? "none" : "local";
    return local;
  }

  private async liveBalance(): Promise<number | null> {
    const t = this.now();
    const fresh = t - this.readAt < (this.opts.ttlMs ?? BALANCE_TTL_MS);
    if (fresh || t - this.failedAt < BALANCE_RETRY_MS) return this.balance;
    this.inflight ??= this.opts
      .fetchBalance()
      .then((n) => {
        this.balance = n;
        this.readAt = this.now();
        return n;
      })
      .catch((err: unknown) => {
        this.failedAt = this.now();
        if (!this.warned) console.warn("[elevenlabs] live balance unreadable, using the local estimate:", err instanceof Error ? err.message : "error");
        this.warned = true;
        // A stale live value is dropped: from here on the local estimate decides.
        this.balance = null;
        return null;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  /** The lowest balance `kind` may spend down to right now. */
  floor(kind: SpeechKind): number {
    if (this.now() < this.opts.reserveUntil) return this.opts.reserveCredits;
    return kind === "stt" ? this.opts.floorCredits : Math.max(this.opts.floorCredits, this.opts.ttsFloorCredits);
  }

  /**
   * May `kind` spend about `credits` now? An unreadable balance allows it (the daily caps still bound the spend);
   * a known one must stay at or above the floor after the call.
   */
  async allows(kind: SpeechKind, credits = 0): Promise<boolean> {
    const left = await this.remaining();
    if (left === null) return true;
    return left - Math.max(0, credits) >= this.floor(kind);
  }

  /** Subtract credits just spent from the cached balance. */
  spend(credits: number): void {
    if (this.balance !== null) this.balance = Math.max(0, this.balance - Math.max(0, credits));
  }
}
