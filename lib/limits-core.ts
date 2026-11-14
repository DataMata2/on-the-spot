// Free-tier drill counters, in memory (reset on restart, not shared between instances). Pure apart from the
// injectable clock; no Next imports, so it is unit-tested directly. lib/limits.ts holds the process singletons.

/** Started drill-1 sessions a free guest gets per UTC day. */
export const FREE_DRILLS_PER_DAY = 3;

export type DrillId = "drill1" | "drill2";

export type LimitResult =
  | { ok: true }
  | { ok: false; status: 402 | 429; error: string; code: "free_limit" | "rate_limited" | "drill2_pro" };

export const FREE_LIMIT_MESSAGE = `You've used today's ${FREE_DRILLS_PER_DAY} free drills. Go Pro for unlimited practice, or come back tomorrow.`;
export const DRILL2_PRO_MESSAGE = "You've had your free try of Clarify the vague task. It's part of Pro.";

/** UTC calendar day of a timestamp, e.g. "2026-11-14". */
export function utcDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export class DrillLimits {
  private daily = new Map<string, { day: string; count: number }>();
  private drill2Used = new Set<string>();

  constructor(private readonly now: () => number = Date.now) {}

  private usedToday(guestId: string): number {
    const entry = this.daily.get(guestId);
    return entry && entry.day === utcDay(this.now()) ? entry.count : 0;
  }

  /** Counts one started drill. Free: 3 drill-1 starts per UTC day, one drill-2 try ever. Pro: unlimited. */
  take(guestId: string, drill: DrillId, pro: boolean): LimitResult {
    if (drill === "drill2") {
      if (pro) return { ok: true };
      if (this.drill2Used.has(guestId)) return { ok: false, status: 402, error: DRILL2_PRO_MESSAGE, code: "drill2_pro" };
      this.drill2Used.add(guestId);
      return { ok: true };
    }
    if (pro) return { ok: true };
    const day = utcDay(this.now());
    const used = this.usedToday(guestId);
    if (used >= FREE_DRILLS_PER_DAY) return { ok: false, status: 402, error: FREE_LIMIT_MESSAGE, code: "free_limit" };
    this.daily.set(guestId, { day, count: used + 1 });
    this.sweep(day);
    return { ok: true };
  }

  /** Read-only view for the UI. Pro guests still see their count; the cap just doesn't apply. */
  usage(guestId: string, pro: boolean): { usedToday: number; freePerDay: 3; drill2FreeUsed: boolean } {
    void pro;
    return { usedToday: this.usedToday(guestId), freePerDay: FREE_DRILLS_PER_DAY, drill2FreeUsed: this.drill2Used.has(guestId) };
  }

  /** Drop entries from past days so the map can't grow without bound. */
  private sweep(today: string) {
    if (this.daily.size < 5_000) return;
    for (const [k, v] of this.daily) if (v.day !== today) this.daily.delete(k);
  }
}
