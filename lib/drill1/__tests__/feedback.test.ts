import { describe, expect, it } from "vitest";
import { runChecks } from "../checks";
import { buildFeedback, combineVerdict, evidenceInOpening, findSpan, guardStrongerVersion, normalizeAi, NOT_ENGLISH_NOTE, validateAi } from "../feedback";

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
  // TM-OTS-04: numbers are matched as whole tokens, not digit by digit.
  it("redacts a decimal built from two separate numbers", () => {
    expect(guardStrongerVersion("It will take 3.5 days.", "We have 3 engineers and 5 remaining tasks.")).toBe("It will take [your number] days.");
  });
  it("redacts the unseen integer (control)", () => {
    expect(guardStrongerVersion("It will take 7 days.", "I need to check the schedule.")).toBe("It will take [your number] days.");
  });
  it("matches decimals, thousands, fractions and percentages as whole tokens", () => {
    expect(guardStrongerVersion("We are 3.5 days late.", "we're about 3.5 days late")).toBe("We are 3.5 days late.");
    expect(guardStrongerVersion("We have 3,000 users.", "3,000 users signed up")).toBe("We have 3,000 users.");
    expect(guardStrongerVersion("We have 3,000 users.", "3000 users signed up")).toBe("We have 3,000 users.");
    expect(guardStrongerVersion("We have 3,000 users.", "3 users and 000 errors")).toBe("We have [your number] users.");
    expect(guardStrongerVersion("Half is done: 1/2.", "we did 1 of 2")).toBe("Half is done: [your number].");
    expect(guardStrongerVersion("We're 50% done.", "about 50 percent done")).toBe("We're 50% done.");
    expect(guardStrongerVersion("We're 50% done.", "50 tickets left")).toBe("We're [your number] done.");
    expect(guardStrongerVersion("We're 15% done.", "about 5% done")).toBe("We're [your number] done.");
    expect(guardStrongerVersion("It costs $300.", "it costs 300 dollars")).toBe("It costs $300.");
  });
  it("checks the number of a number+unit pair", () => {
    expect(guardStrongerVersion("Ship by 5pm.", "ship by 5 pm today")).toBe("Ship by 5pm.");
    expect(guardStrongerVersion("Ship by 10:30.", "ship by 10 and test by 30")).toBe("Ship by [your number].");
    expect(guardStrongerVersion("We need 10k rows.", "we need 1 or 0 rows")).toBe("We need [your number]k rows.");
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
    // TM-OTS-03: a step the model calls present but whose quote is not in the transcript is not shown as present.
    expect(ai.structure.nextStep).toEqual({ present: false, quote: null });
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
  it("reads the model's english flag (missing → true)", () => {
    expect(normalizeAi(raw, T)!.english).toBe(true);
    expect(normalizeAi({ ...raw, english: false }, T)!.english).toBe(false);
  });
  it("caps a non-English answer at 'not yet' by the word check when there is no AI result", () => {
    const es = "Sí, vamos bien. La API está lista y el QA empieza el lunes.";
    const fb = buildFeedback({ questionId: "x", graded: es, edited: false, checks: runChecks(es), ai: null });
    expect(fb).toMatchObject({ english: false, structure: null, strongerVersion: null, answerFirst: { verdict: "no", note: NOT_ENGLISH_NOTE } });
  });
  it("trusts the model over the word check for terse English", () => {
    const terse = "Status green, deploy Friday, Kubernetes migration finished.";
    const fb = buildFeedback({ questionId: "x", graded: terse, edited: false, checks: runChecks(terse), ai: normalizeAi({ ...raw, english: true }, terse) });
    expect(fb.english).toBe(true);
  });
  it("caps the verdict when only the model says it is not English", () => {
    const fb = buildFeedback({ questionId: "x", graded: T, edited: false, checks: runChecks(T), ai: normalizeAi({ ...raw, english: false }, T) });
    expect(fb).toMatchObject({ english: false, structure: null, answerFirst: { verdict: "no", note: NOT_ENGLISH_NOTE } });
  });
  it("marks English answers english", () => {
    expect(buildFeedback({ questionId: "x", graded: T, edited: false, checks: runChecks(T), ai: normalizeAi(raw, T) }).english).toBe(true);
  });
  it("still answers without the AI", () => {
    const fb = buildFeedback({ questionId: "x", graded: "well it is complicated", edited: false, checks: runChecks("well it is complicated"), ai: null });
    expect(fb).toMatchObject({ aiAvailable: false, structure: null, strongerVersion: null, answerFirst: { verdict: "no", ai: null } });
  });
});

describe("TM-OTS-03: structure and answer-first need verified evidence", () => {
  const aiRaw = (quote: string) => ({
    answerFirst: { verdict: "yes", evidenceQuote: quote, note: "Clear." },
    structure: { point: { present: true, quote }, reason: { present: false, quote: "" }, nextStep: { present: false, quote: "" } },
    strongerVersion: quote,
    tip: "Give one reason.",
  });
  it("an unsupported next step is not present, and is reported as an issue", () => {
    const raw = aiRaw("The API is ready.");
    raw.structure.nextStep = { present: true, quote: "I will email Sam tomorrow" };
    const v = validateAi(raw, "The API is ready.");
    expect(v.ai!.structure.nextStep.present).toBe(false);
    expect(v.issues).toContain("nextStep: quote not in the transcript");
  });
  it("a step claimed present with an empty quote is not present", () => {
    const raw = aiRaw("The API is ready.");
    raw.structure.reason = { present: true, quote: "" };
    expect(normalizeAi(raw, "The API is ready.")!.structure.reason).toEqual({ present: false, quote: null });
  });
  it("clean output has no issues", () => {
    expect(validateAi(aiRaw("The API is ready."), "The API is ready.").issues).toEqual([]);
  });
  it("a new number in the stronger version is an issue", () => {
    const raw = { ...aiRaw("The API is ready."), strongerVersion: "The API is ready in 3.5 days." };
    expect(validateAi(raw, "The API is ready.").issues).toContain("strongerVersion: new number or day");
  });
  it("late evidence does not prove answer-first", () => {
    const text =
      "Before I get to the status, I want to explain what happened during the planning session and why our team spent so much time discussing the requirements. The migration is on track.";
    const fb = buildFeedback({ questionId: "st-migration", graded: text, edited: false, checks: runChecks(text), ai: normalizeAi(aiRaw("The migration is on track"), text) });
    expect(fb.answerFirst.verdict).toBe("partly");
    expect(evidenceInOpening(text, "The migration is on track")).toBe(false);
  });
  it("evidence in the opening still proves answer-first", () => {
    const text = "The migration is on track. We finished the schema work yesterday.";
    expect(evidenceInOpening(text, "The migration is on track")).toBe(true);
  });
});
