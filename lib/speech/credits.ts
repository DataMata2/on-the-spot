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

/** Credits held for one call in flight. */
export interface CreditHold {
  readonly credits: number;
  /** The call went through: stop holding and count `actual` credits as spent (against the cached live balance). */
  settle(actual: number): void;
  /** The call failed or was refused: stop holding, nothing spent. */
  release(): void;
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
   * The lower one, because ElevenLabs' character_count can lag behind calls just made. Credits held by calls in
   * flight are not subtracted here (see available()).
   */
  async remaining(): Promise<number | null> {
    await this.liveBalance();
    return this.snapshot();
  }

  /** remaining() from what is already known, without a read: synchronous, so a check and a hold can't interleave. */
  private snapshot(): number | null {
    const live = this.balance;
    const raw = this.opts.localBalance?.() ?? null;
    const local = raw === null ? null : Math.max(0, raw);
    if (live !== null && (local === null || live <= local)) {
      this.source = "live";
      return live;
    }
    this.source = local === null ? "none" : "local";
    return local;
  }

  /** Credits held by calls in flight (reserved, not settled yet). */
  private held = 0;

  /** The balance minus the credits held by calls in flight; null when unknown. Synchronous. */
  available(): number | null {
    const left = this.snapshot();
    return left === null ? null : left - this.held;
  }

  /** Refresh the cached live balance if it is stale. Call before tryReserve(). */
  async refresh(): Promise<void> {
    await this.liveBalance();
  }

  /**
   * Hold `credits` for a call about to be made, in one synchronous step: false (nothing held) when the balance
   * minus what other calls already hold would end below the floor. An unknown balance allows it (the daily caps
   * still bound the spend). Every hold must end with settle() or release().
   */
  tryReserve(kind: SpeechKind, credits: number): CreditHold | null {
    const amount = Math.max(0, credits);
    const left = this.available();
    if (left !== null && left - amount < this.floor(kind)) return null;
    this.held += amount;
    let open = true;
    const close = () => {
      if (!open) return false;
      open = false;
      this.held = Math.max(0, this.held - amount);
      return true;
    };
    return {
      credits: amount,
      settle: (actual: number) => {
        if (close()) this.spend(actual);
      },
      release: () => {
        close();
      },
    };
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
   * a known one, minus the credits held by calls in flight, must stay at or above the floor after the call.
   * Only a hint (for /api/speech/config): a call must hold its credits with tryReserve().
   */
  async allows(kind: SpeechKind, credits = 0): Promise<boolean> {
    await this.liveBalance();
    const left = this.available();
    if (left === null) return true;
    return left - Math.max(0, credits) >= this.floor(kind);
  }

  /** Subtract credits just spent from the cached balance. */
  spend(credits: number): void {
    if (this.balance !== null) this.balance = Math.max(0, this.balance - Math.max(0, credits));
  }
}
