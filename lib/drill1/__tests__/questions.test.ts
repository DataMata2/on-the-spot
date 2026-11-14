import { describe, expect, it } from "vitest";
import { QUESTION_TYPES, QUESTIONS, dailyType, getQuestion, pickQuestion } from "../questions";

describe("question bank", () => {
  it("has at least 12 questions with unique ids, 3+ per type", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const t of QUESTION_TYPES) expect(QUESTIONS.filter((q) => q.type === t).length).toBeGreaterThanOrEqual(3);
  });
  it("looks up by id", () => {
    expect(getQuestion("st-onboarding")?.type).toBe("status");
    expect(getQuestion("nope")).toBeNull();
    expect(getQuestion(42)).toBeNull();
  });
});

describe("pickQuestion", () => {
  it("a retry is a new question of the same type", () => {
    for (let i = 0; i < 20; i++) {
      const q = pickQuestion("status", ["st-onboarding"]);
      expect(q.type).toBe("status");
      expect(q.id).not.toBe("st-onboarding");
    }
  });
  it("never repeats the last question even when all are seen", () => {
    const all = QUESTIONS.filter((q) => q.type === "blocker").map((q) => q.id);
    for (let i = 0; i < 20; i++) expect(pickQuestion("blocker", all).id).not.toBe(all[all.length - 1]);
  });
  it("is deterministic with an injected rand", () => {
    expect(pickQuestion("estimate", [], () => 0).id).toBe("es-feature");
  });
});

describe("dailyType", () => {
  it("rotates through the four types day by day", () => {
    const days = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"].map(dailyType);
    expect(new Set(days).size).toBe(4);
    expect(dailyType("2026-11-18")).toBe(days[0]);
  });
});
