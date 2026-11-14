import { describe, expect, it } from "vitest";
import { addDays, currentStreak, summarize, weekStrip, type DrillResult } from "../store";

const r = (day: string, help: DrillResult["help"] = "independent", extra: Partial<DrillResult> = {}): DrillResult => ({
  id: `${day}-${Math.random()}`, at: `${day}T12:00:00.000Z`, day, drill: "drill1", questionId: "st-onboarding", help, verdict: "yes", words: 30, ...extra,
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("currentStreak", () => {
  const today = "2026-11-14";
  it("is 0 with no drills", () => expect(currentStreak([], today)).toBe(0));
  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-14"], today)).toBe(3);
  });
  it("stays alive when today is not done yet", () => {
    expect(currentStreak(["2026-11-12", "2026-11-13"], today)).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(currentStreak(["2026-11-10", "2026-11-11", "2026-11-13", "2026-11-14"], today)).toBe(2);
    expect(currentStreak(["2026-11-11", "2026-11-12"], today)).toBe(0);
  });
});

describe("weekStrip / summarize", () => {
  const today = "2026-11-14";
  const results = [r("2026-11-07"), r("2026-11-08"), r("2026-11-13", "with_help"), r(today), r(today, "with_help", { verdict: "partly" }), r(today, "independent", { drill: "drill2" })];
  it("shows the last 7 days ending today", () => {
    const w = weekStrip(results, today);
    expect(w.map((d) => d.day)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(w.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 1, 3]);
    expect(w[6].isToday).toBe(true);
  });
  it("summarizes today, all time, streak, tomorrow", () => {
    const s = summarize(results, today);
    expect(s.today).toEqual({ total: 3, independent: 2, withHelp: 1, answerFirst: 2 });
    expect(s.allTime).toEqual({ total: 6, independent: 4, withHelp: 2 });
    expect(s.streak).toBe(2);
    expect(s.drill2Tried).toBe(true);
    expect(["status", "decision", "estimate", "blocker"]).toContain(s.tomorrowType);
  });
});
