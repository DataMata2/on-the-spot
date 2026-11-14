import { describe, expect, it } from "vitest";
import { DrillLimits, FREE_DRILLS_PER_DAY, utcDay } from "@/lib/limits-core";

function clock(start: string) {
  let t = Date.parse(start);
  return { now: () => t, set: (iso: string) => (t = Date.parse(iso)) };
}

describe("takeDrillStart (DrillLimits)", () => {
  it("allows 3 free drill-1 starts per day, the 4th is 402 free_limit", () => {
    const c = clock("2026-11-14T10:00:00Z");
    const l = new DrillLimits(c.now);
    for (let i = 0; i < FREE_DRILLS_PER_DAY; i++) expect(l.take("g1", "drill1", false)).toEqual({ ok: true });
    const fourth = l.take("g1", "drill1", false);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.status).toBe(402);
      expect(fourth.code).toBe("free_limit");
      expect(fourth.error).toMatch(/3 free drills/);
    }
    expect(l.usage("g1", false)).toEqual({ usedToday: 3, freePerDay: 3, drill2FreeUsed: false });
  });

  it("counts each guest separately", () => {
    const l = new DrillLimits(clock("2026-11-14T10:00:00Z").now);
    for (let i = 0; i < 3; i++) l.take("g1", "drill1", false);
    expect(l.take("g2", "drill1", false).ok).toBe(true);
  });

  it("Pro is unlimited for drill 1 and drill 2", () => {
    const l = new DrillLimits(clock("2026-11-14T10:00:00Z").now);
    for (let i = 0; i < 20; i++) {
      expect(l.take("g1", "drill1", true).ok).toBe(true);
      expect(l.take("g1", "drill2", true).ok).toBe(true);
    }
  });

  it("drill 2: one free try, then 402 drill2_pro (even on a new day)", () => {
    const c = clock("2026-11-14T10:00:00Z");
    const l = new DrillLimits(c.now);
    expect(l.take("g1", "drill2", false).ok).toBe(true);
    expect(l.usage("g1", false).drill2FreeUsed).toBe(true);
    const second = l.take("g1", "drill2", false);
    expect(second).toMatchObject({ ok: false, status: 402, code: "drill2_pro" });
    c.set("2026-11-20T10:00:00Z");
    expect(l.take("g1", "drill2", false)).toMatchObject({ ok: false, code: "drill2_pro" });
    // drill 2 does not use up the drill-1 allowance
    expect(l.usage("g1", false).usedToday).toBe(0);
  });

  it("a new UTC day resets the drill-1 count", () => {
    const c = clock("2026-11-14T23:59:00Z");
    const l = new DrillLimits(c.now);
    for (let i = 0; i < 3; i++) l.take("g1", "drill1", false);
    expect(l.take("g1", "drill1", false).ok).toBe(false);
    c.set("2026-11-15T00:00:30Z");
    expect(l.usage("g1", false).usedToday).toBe(0);
    expect(l.take("g1", "drill1", false).ok).toBe(true);
    expect(l.usage("g1", false).usedToday).toBe(1);
  });

  it("utcDay uses UTC", () => {
    expect(utcDay(Date.parse("2026-11-14T23:30:00-05:00"))).toBe("2026-11-15");
  });
});
