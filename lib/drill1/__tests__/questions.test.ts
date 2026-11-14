import { describe, expect, it } from "vitest";
import { prewarmTexts } from "@/lib/speech/prewarm";
import { staticTtsTexts } from "@/lib/speech/tts-allow";
import { QUESTION_TYPES, QUESTIONS, TYPE_HINTS, dailyType, getQuestion, pickQuestion, situationText } from "../questions";
import { ROLE_QUESTIONS } from "../roles";

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

describe("juryQuestion", () => {
  it("gives a fresh guest the fixed jury order, then hands over to the random pick", async () => {
    const { JURY_ORDER, juryQuestion } = await import("../questions");
    const seen: string[] = [];
    for (const id of JURY_ORDER) {
      const q = juryQuestion(seen);
      expect(q?.id).toBe(id);
      seen.push(id);
    }
    expect(juryQuestion(seen)).toBeNull();
    for (const id of JURY_ORDER) expect(getQuestion(id)).not.toBeNull();
  });
});

describe("situation (5b)", () => {
  const all = [...QUESTIONS, ...ROLE_QUESTIONS];
  it("every general and role-bank question has two short lines: who you are, then the facts", () => {
    expect(all.length).toBe(QUESTIONS.length + 42);
    for (const q of all) {
      expect(q.situation, q.id).toHaveLength(2);
      for (const line of q.situation!) {
        expect(line.length, `${q.id}: ${line}`).toBeGreaterThan(10);
        expect(line.length, `${q.id}: ${line}`).toBeLessThanOrEqual(200);
        expect(line, q.id).toMatch(/[.!]$/);
        expect(line).not.toBe(q.text);
      }
      expect(q.situation![0], q.id).toMatch(/^(You|Your)\b/);
    }
    expect(new Set(all.map((q) => q.situation![1])).size).toBe(all.length);
  });

  it("is display-only: no situation line is on the TTS allow-list or in any prewarm set", () => {
    const allowed = staticTtsTexts();
    const prewarm = [...prewarmTexts(), ...prewarmTexts("roles")];
    for (const q of all) {
      for (const line of q.situation!) {
        expect(allowed.has(line)).toBe(false);
        expect(prewarm.some((t) => t.includes(line))).toBe(false);
      }
    }
  });

  it("situationText joins the lines, empty without a situation", () => {
    expect(situationText({ situation: ["You lead QA.", "The fix is in review."] })).toBe("You lead QA. The fix is in review.");
    expect(situationText({})).toBe("");
  });
});

describe("type hints (5d)", () => {
  it("make the fact-dependent advice conditional", () => {
    expect(TYPE_HINTS.status).toMatch(/If you don't know/);
    expect(TYPE_HINTS.decision).toMatch(/If you can't decide/);
    expect(TYPE_HINTS.estimate).toMatch(/If you can't estimate/);
  });
});
