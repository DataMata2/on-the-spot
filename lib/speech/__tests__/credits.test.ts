import { describe, expect, it, vi } from "vitest";
import { CreditGuard } from "../credits";

const RESERVE_UNTIL = Date.parse("2026-11-15T07:00:00Z");

function guard(balance: number | (() => Promise<number>), now: () => number) {
  const fetchBalance = vi.fn(typeof balance === "number" ? async () => balance : balance);
  return { g: new CreditGuard({ fetchBalance, reserveUntil: RESERVE_UNTIL, reserveCredits: 3000, floorCredits: 200, ttsFloorCredits: 1000, now }), fetchBalance };
}

describe("CreditGuard", () => {
  it("keeps the reserve before the jury window", async () => {
    const { g } = guard(3100, () => RESERVE_UNTIL - 1000);
    expect(await g.allows("stt", 50)).toBe(true);
    expect(await g.allows("stt", 200)).toBe(false); // would dip under 3000
    expect(await g.allows("tts", 200)).toBe(false);
  });

  it("after the window, STT spends down to 200 and TTS to 1000", async () => {
    const { g } = guard(1100, () => RESERVE_UNTIL + 1000);
    expect(await g.allows("stt", 800)).toBe(true);
    expect(await g.allows("stt", 950)).toBe(false);
    expect(await g.allows("tts", 50)).toBe(true);
    expect(await g.allows("tts", 150)).toBe(false);
  });

  it("caches the balance for 5 minutes and subtracts local spend in between", async () => {
    let t = RESERVE_UNTIL + 1000;
    const { g, fetchBalance } = guard(5000, () => t);
    expect(await g.remaining()).toBe(5000);
    g.spend(1200);
    t += 60_000;
    expect(await g.remaining()).toBe(3800);
    expect(fetchBalance).toHaveBeenCalledTimes(1);
    t += 5 * 60_000;
    expect(await g.remaining()).toBe(5000);
    expect(fetchBalance).toHaveBeenCalledTimes(2);
  });

  it("a scoped key (401 on the subscription) falls back to the local estimate, with the same reserve rules", async () => {
    let used = 6900;
    const fetchBalance = vi.fn(async () => {
      throw new Error("subscription: HTTP 401");
    });
    const g = new CreditGuard({ fetchBalance, localBalance: () => 10_000 - used, reserveUntil: RESERVE_UNTIL, reserveCredits: 3000, floorCredits: 200, ttsFloorCredits: 1000, now: () => RESERVE_UNTIL - 1000 });
    expect(await g.remaining()).toBe(3100);
    expect(g.source).toBe("local");
    expect(await g.allows("stt", 50)).toBe(true);
    used = 7050;
    expect(await g.allows("stt", 0)).toBe(false);
    expect(fetchBalance).toHaveBeenCalledTimes(1); // not retried on every call
  });

  it("with both, the lower of the live and local balances counts (the live counter can lag)", async () => {
    const g = new CreditGuard({ fetchBalance: async () => 10_000, localBalance: () => 10_000 - 4000, reserveUntil: RESERVE_UNTIL, reserveCredits: 3000, floorCredits: 200, ttsFloorCredits: 1000, now: () => RESERVE_UNTIL - 1 });
    expect(await g.remaining()).toBe(6000);
    expect(g.source).toBe("local");
    const h = new CreditGuard({ fetchBalance: async () => 5000, localBalance: () => 9000, reserveUntil: RESERVE_UNTIL, reserveCredits: 3000, floorCredits: 200, ttsFloorCredits: 1000, now: () => RESERVE_UNTIL - 1 });
    expect(await h.remaining()).toBe(5000);
    expect(h.source).toBe("live");
  });

  it("an unreadable balance with no local estimate doesn't block (the daily caps still apply); retried later", async () => {
    let t = RESERVE_UNTIL - 1000;
    const { g, fetchBalance } = guard(async () => {
      throw new Error("401");
    }, () => t);
    expect(await g.remaining()).toBeNull();
    expect(await g.allows("stt", 100)).toBe(true);
    expect(fetchBalance).toHaveBeenCalledTimes(1);
    t += 10 * 60_000 + 1000;
    await g.remaining();
    expect(fetchBalance).toHaveBeenCalledTimes(2);
  });
});
