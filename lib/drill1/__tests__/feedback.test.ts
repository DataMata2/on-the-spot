import { describe, expect, it } from "vitest";
import { runChecks } from "../checks";
import {
  buildFeedback,
  combineVerdict,
  evidenceInOpening,
  FEEDBACK_SYSTEM,
  feedbackUserMessage,
  findSpan,
  guardStrongerVersion,
  normalizeAi,
  givenText,
  NOT_ENGLISH_NOTE,
  validateAi,
} from "../feedback";
import { getAnyQuestion } from "../roles";

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
    // A glued "k" is part of the number now (B-R14-03): the whole "10k" becomes the placeholder.
    expect(guardStrongerVersion("We need 10k rows.", "we need 1 or 0 rows")).toBe("We need [your number] rows.");
  });
  it("reads k and m as thousands and millions (B-R14-03)", () => {
    const q3 = givenText({ context: "Agenda item 2. The finance partner turns to you:", text: "You want $6k for the device lab this quarter." });
    const t = "We need the budget for the device lab.";
    for (const known of ["we need $6k", "about 6k", "6,000 dollars", "6000 for devices", "$6K"]) {
      expect(guardStrongerVersion("We need $6k for the lab.", known)).toBe("We need $6k for the lab.");
      expect(guardStrongerVersion("We need 6,000 for the lab.", known)).toBe("We need 6,000 for the lab.");
      expect(guardStrongerVersion("We need 6k for the lab.", t, known)).toBe("We need 6k for the lab.");
    }
    expect(guardStrongerVersion("We need $6k for the lab.", t, q3)).toBe("We need $6k for the lab.");
    expect(guardStrongerVersion("We need $1.5m.", "we asked for 1,500,000")).toBe("We need $1.5m.");
    // A different number, or the bare digit without its "k", is still new.
    expect(guardStrongerVersion("We need $7k for the lab.", t, q3)).toBe("We need [your number] for the lab.");
    expect(guardStrongerVersion("We need $6k for the lab.", "we need 6 devices")).toBe("We need [your number] for the lab.");
    expect(guardStrongerVersion("We need 6 devices.", t, q3)).toBe("We need [your number] devices.");
    expect(guardStrongerVersion("We need $5k, 12 devices.", t, "")).toBe("We need [your number], [your number] devices.");
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

describe("the question's situation (5b)", () => {
  const given = "You lead the mobile team. The release slipped 2 days because QA found a login bug; the fix ships Thursday.";
  it("the guard accepts numbers and days from the situation", () => {
    expect(guardStrongerVersion("We slipped 2 days; the fix ships Thursday.", "we are a bit late", given)).toBe("We slipped 2 days; the fix ships Thursday.");
  });
  it("still redacts numbers and days that are in neither", () => {
    expect(guardStrongerVersion("We slipped 3 days; it ships Friday.", "we are a bit late", given)).toBe("We slipped [your number] days; it ships [the date].");
    expect(guardStrongerVersion("We slipped 2 days.", "we are a bit late")).toBe("We slipped [your number] days.");
  });
  it("validateAi uses the situation for the guard, but quotes still come from the transcript only", () => {
    const raw = {
      english: true,
      answerFirst: { verdict: "yes", evidenceQuote: "QA found a login bug", note: "ok" },
      structure: { point: { present: true, quote: "QA found a login bug" }, reason: { present: false, quote: "" }, nextStep: { present: false, quote: "" } },
      strongerVersion: "We're 2 days late; the fix ships Thursday.",
      tip: "t",
    };
    const v = validateAi(raw, "we are a bit late", given);
    expect(v.ai!.strongerVersion).toBe("We're 2 days late; the fix ships Thursday.");
    expect(v.ai!.structure.point.present).toBe(false);
    expect(v.ai!.answerFirst.evidenceQuote).toBeNull();
  });
  it("the user message carries the situation of a bank question", () => {
    const q = getAnyQuestion("se-st-deploy")!;
    const msg = feedbackUserMessage(q, "it is in review");
    expect(msg).toContain("<situation>");
    expect(msg).toContain(q.situation![1]);
    expect(feedbackUserMessage({ ...q, situation: undefined }, "x")).not.toContain("<situation>");
  });
});

describe("facts the question itself gave (B-R12-03)", () => {
  const q = {
    context: "Release sync. The QA lead asks:",
    text: "Should we roll Android 14 back to 13 before the 3.2 release on Friday?",
    situation: ["Crash rate on Android 14 is 4%."],
  };
  const raw = {
    english: true,
    answerFirst: { verdict: "yes", evidenceQuote: "roll Android 14 back to 13", note: "ok" },
    structure: { point: { present: true, quote: "Android 14" }, reason: { present: false, quote: "" }, nextStep: { present: false, quote: "" } },
    strongerVersion: "Yes, roll Android 14 back to 13 before the 3.2 release on Friday: crashes are at 4%.",
    tip: "t",
  };
  it("givenText joins the context line, the question and its situation", () => {
    expect(givenText(q)).toBe(`${q.context}\n${q.text}\n${q.situation[0]}`);
    expect(givenText({ context: "", text: "Ready?", situation: undefined })).toBe("Ready?");
  });
  it("the stronger version keeps the question's numbers and days, but not new ones", () => {
    const v = validateAi(raw, "yes we should roll back, it keeps crashing", givenText(q));
    expect(v.ai!.strongerVersion).toBe(raw.strongerVersion);
    expect(v.issues).not.toContain("strongerVersion: new number or day");
    expect(guardStrongerVersion("Roll back to 12 by Monday.", "yes roll back", givenText(q))).toBe("Roll back to [your number] by [the date].");
  });
  it("evidence quotes still come from the transcript only, never the question", () => {
    const v = validateAi(raw, "yes we should roll back, it keeps crashing", givenText(q));
    expect(v.ai!.answerFirst.evidenceQuote).toBeNull();
    expect(v.ai!.structure.point.present).toBe(false);
  });
});

describe("no invented facts (5d)", () => {
  it("the system prompt forbids facts outside the transcript and situation, and asks for conditional phrasing", () => {
    expect(FEEDBACK_SYSTEM).toMatch(/never invent facts that are not in the transcript, the question or the situation/);
    expect(FEEDBACK_SYSTEM).toMatch(/conditional phrasing/);
    expect(FEEDBACK_SYSTEM).toMatch(/\[placeholder\]/);
    expect(FEEDBACK_SYSTEM).toMatch(/If the client hasn't replied yet/);
  });
});
