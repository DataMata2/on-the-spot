import { describe, expect, it } from "vitest";
import { runChecks } from "../checks";
import { buildFeedback, combineVerdict, findSpan, guardStrongerVersion, normalizeAi } from "../feedback";

const T = "So we’re on track for Friday.  The API is done, and QA starts Monday.";

describe("findSpan", () => {
  it("returns exact substrings unchanged", () => {
    expect(findSpan(T, "The API is done")).toBe("The API is done");
  });
  it("matches case/whitespace/curly-quote differences but returns the original span", () => {
    const s = findSpan(T, "we're ON track for friday. the api");
    expect(s).toBe("we’re on track for Friday.  The API");
    expect(T.includes(s!)).toBe(true);
  });
  it("trims quote punctuation", () => {
    expect(findSpan(T, '"QA starts Monday."')).toBe("QA starts Monday");
  });
  it("rejects invented quotes", () => {
    expect(findSpan(T, "we shipped it yesterday")).toBeNull();
    expect(findSpan(T, "")).toBeNull();
  });
});

describe("guardStrongerVersion", () => {
  it("replaces numbers and days the user never said", () => {
    expect(guardStrongerVersion("We'll ship on Thursday, about 3 days late, QA Monday.", T)).toBe(
      "We'll ship on [the date], about [your number] days late, QA Monday.",
    );
  });
  it("leaves existing placeholders alone", () => {
    expect(guardStrongerVersion("I'll close it [by when, e.g. today] and ship Friday.", T)).toBe("I'll close it [by when, e.g. today] and ship Friday.");
  });
  it("keeps numbers the user said", () => {
    expect(guardStrongerVersion("It will take 2 weeks.", "maybe 2 weeks")).toBe("It will take 2 weeks.");
  });
});

describe("combineVerdict", () => {
  it("keeps yes only with backing", () => {
    expect(combineVerdict("yes", true, false)).toBe("yes");
    expect(combineVerdict("yes", false, true)).toBe("yes");
    expect(combineVerdict("yes", false, false)).toBe("partly");
  });
  it("does not upgrade partly/no from a word alone", () => {
    expect(combineVerdict("no", true, true)).toBe("no");
    expect(combineVerdict("partly", true, true)).toBe("partly");
  });
  it("falls back to the word check without the model", () => {
    expect(combineVerdict(null, true, false)).toBe("partly");
    expect(combineVerdict(null, false, false)).toBe("no");
  });
});

describe("normalizeAi + buildFeedback", () => {
  const raw = {
    answerFirst: { verdict: "yes", evidenceQuote: "on track for Friday", note: "Clear." },
    structure: {
      point: { present: true, quote: "we're on track for friday" },
      reason: { present: true, quote: "The API is done" },
      nextStep: { present: true, quote: "QA starts Tuesday" },
    },
    strongerVersion: "We're on track for Friday. The API is done; QA starts Monday.",
    tip: "Name the risk too.",
  };
  it("drops quotes that are not in the transcript", () => {
    const ai = normalizeAi(raw, T)!;
    expect(ai.answerFirst.evidenceQuote).toBe("on track for Friday");
    expect(ai.structure.point.quote).toBe("we’re on track for Friday");
    expect(ai.structure.nextStep).toEqual({ present: true, quote: null });
  });
  it("rejects malformed output", () => {
    expect(normalizeAi({ answerFirst: { verdict: "maybe" } }, T)).toBeNull();
    expect(normalizeAi("nope", T)).toBeNull();
  });
  it("merges checks and AI into the response", () => {
    const fb = buildFeedback({ questionId: "st-onboarding", graded: T, edited: false, checks: runChecks(T), ai: normalizeAi(raw, T) });
    expect(fb.answerFirst).toMatchObject({ verdict: "yes", ai: "yes", wordCheck: { passed: true, word: "on track" } });
    expect(fb.aiAvailable).toBe(true);
  });
  it("still answers without the AI", () => {
    const fb = buildFeedback({ questionId: "x", graded: "well it is complicated", edited: false, checks: runChecks("well it is complicated"), ai: null });
    expect(fb).toMatchObject({ aiAvailable: false, structure: null, strongerVersion: null, answerFirst: { verdict: "no", ai: null } });
  });
});
