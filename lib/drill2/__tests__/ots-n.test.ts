// Teammate review OTS-N01/N02/N03: a self-correction, a negated action or a hedge must not confirm a value.
// These grade prepared quotes through the engine; they show what the engine does with a span, not what the live
// extractor returns for these sentences.
import { describe, expect, it } from "vitest";
import { createState, fireChangeIfDue, gradeConfirmation, readSlot, revealFor } from "../engine";
import { afterCorrection, negationReadings, parseNumber } from "../normalise";
import { KICKOFF_CHANGE as S3, NUMBERS_FOR_THURSDAY as S1 } from "../scenarios";
import type { Scenario } from "../types";

/** Every topic asked, and the condition change fired (Tuesday → Wednesday). */
function ready(s: Scenario) {
  const st = revealFor(s, createState(s), { intent: "question", topics: s.topics.map((t) => t.key) }).state;
  return fireChangeIfDue(s, st, true).state;
}
const graded = (s: Scenario, key: string, quote: string | null, utterance: string) =>
  gradeConfirmation(s, ready(s), quote ? { [key]: { evidenceQuote: quote } } : {}, { utterance }).facts.find((f) => f.key === key)!;
const fact = (s: Scenario, key: string) => [...s.hiddenFacts, ...s.visibleFacts].find((f) => f.key === key)!;

/** [span as the extractor is told to quote it, a narrower span it might still return, the sentence around it]. */
const NOT_CONFIRMED: [string, string, string][] = [
  ["30 minutes, actually 30 hours", "30 minutes", "So Wednesday at 2 pm with Priya and Marco, 30 minutes, actually 30 hours."],
  ["30 minutes, no wait, 30 hours", "30 minutes", "So Wednesday at 2 pm, 30 minutes, no wait, 30 hours, with Priya and Marco."],
  ["I will not schedule a 30 minute call", "a 30 minute call", "I will not schedule a 30 minute call with Priya and Marco on Wednesday at 2 pm."],
  ["not 30 minutes", "30 minutes", "So Wednesday at 2 pm with Priya and Marco, not 30 minutes."],
  ["30 minutes or maybe an hour", "30 minutes", "So Wednesday at 2 pm with Priya and Marco, 30 minutes or maybe an hour."],
  ["30 minutes or maybe 2 hours", "30 minutes", "So Wednesday at 2 pm with Priya and Marco, 30 minutes or maybe 2 hours."],
  ["I won't book 30 minutes", "30 minutes", "I won't book 30 minutes with Priya and Marco on Wednesday at 2 pm."],
  ["don't schedule the 30 minute call", "the 30 minute call", "So don't schedule the 30 minute call with Priya and Marco on Wednesday at 2 pm."],
];

describe("OTS-N: duration is not confirmed", () => {
  describe.each(NOT_CONFIRMED)("%s", (span, narrow, sentence) => {
    it("span alone (span = utterance)", () => {
      expect(graded(S3, "duration", span, span).status).not.toBe("correct");
    });
    it("extractor span inside the sentence", () => {
      expect(graded(S3, "duration", span, sentence).status).not.toBe("correct");
    });
    it("narrower span inside the sentence", () => {
      expect(graded(S3, "duration", narrow, sentence).status).not.toBe("correct");
    });
    it("the whole sentence as the span", () => {
      expect(graded(S3, "duration", sentence, sentence).status).not.toBe("correct");
    });
    it("no span (keyword fallback reads the sentence)", () => {
      expect(graded(S3, "duration", null, sentence).status).not.toBe("correct");
    });
  });

  it("gives the reason: corrected to the wrong unit, a negation, a hedge", () => {
    expect(graded(S3, "duration", "30 minutes, actually 30 hours", "30 minutes, actually 30 hours").reason).toBe("wrong_unit");
    expect(graded(S3, "duration", "30 minutes, no wait, 30 hours", "30 minutes, no wait, 30 hours").reason).toBe("wrong_unit");
    for (const q of ["I will not schedule a 30 minute call", "not 30 minutes", "I won't book 30 minutes", "don't schedule the 30 minute call"]) {
      expect([q, graded(S3, "duration", q, q).reason]).toEqual([q, "negated"]);
    }
    expect(graded(S3, "duration", "30 minutes or maybe an hour", "30 minutes or maybe an hour").reason).toBe("ambiguous");
    expect(graded(S3, "duration", "30 minutes", "So 30 minutes or maybe 2 hours.").reason).toBe("ambiguous");
  });
});

describe("OTS-N: still confirmed", () => {
  it.each([
    "30 minutes",
    "half an hour",
    "a 30-minute call",
    "thirty minutes",
    "30 hours, actually 30 minutes",
    "an hour, no wait, 30 minutes",
    "30 minutes, actually at 2 pm",
    "I won't book an hour, 30 minutes",
    "I won't forget to book 30 minutes",
    "30 minutes, not an hour",
  ])("%s", (q) => {
    expect(graded(S3, "duration", q, q).status).toBe("correct");
  });
  it.each([
    "So Wednesday at 2 pm, 30 minutes, with Priya and Marco.",
    "So Tuesday, actually Wednesday, at 2 pm for 30 minutes with Priya and Marco.",
    "So it's Wednesday now, not Tuesday, at 2 p.m. with Priya and Marco, half an hour.",
    "So I won't invite anyone else, just Priya and Marco, Wednesday 2 pm, 30 minutes.",
    "So Wednesday from 2–2:30 pm with Priya and Marco, not an hour.",
  ])("whole confirmation: %s", (utterance) => {
    expect(gradeConfirmation(S3, ready(S3), {}, { utterance }).allCorrect).toBe(true);
  });
});

describe("OTS-N: the same rule on days and times", () => {
  it("a corrected day: the later one is read", () => {
    expect(graded(S3, "day", "Tuesday, actually Wednesday", "Tuesday, actually Wednesday").status).toBe("correct");
    expect(graded(S3, "day", "Wednesday, actually Thursday", "Wednesday, actually Thursday").reason).toBe("wrong_value");
    expect(graded(S3, "day", "Wednesday, no wait, Tuesday", "Wednesday, no wait, Tuesday").reason).toBe("outdated");
    // The narrow span can't hide the correction: the whole utterance is re-read.
    expect(graded(S3, "day", "Wednesday", "So Wednesday, actually Thursday, at 2 pm.").status).toBe("contradicted");
    expect(graded(S1, "day", "by Thursday", "So three slides by Thursday, actually Friday.").status).toBe("contradicted");
  });
  it("a corrected time: the later one is read", () => {
    expect(graded(S3, "time", "2 pm, actually 3 pm", "2 pm, actually 3 pm").status).toBe("contradicted");
    expect(graded(S3, "time", "3 pm, sorry, 2 pm", "3 pm, sorry, 2 pm").status).toBe("correct");
  });
  it("a negated action on a day or time is not a confirmation", () => {
    expect(graded(S3, "day", "I won't schedule it on Wednesday", "I won't schedule it on Wednesday").reason).toBe("negated");
    expect(graded(S3, "time", "I won't book it at 2 pm", "I won't book it at 2 pm").reason).toBe("negated");
  });
});

describe("OTS-N: normalisers", () => {
  const mins = ["minutes", "minute", "mins", "min"];
  it("a count in the fact's unit and one in another unit is ambiguous", () => {
    expect(parseNumber("30 minutes or 2 hours", mins, { otherUnits: ["hours", "hour"] })).toEqual({ kind: "ambiguous" });
    expect(parseNumber("30 minutes, not 2 hours", mins, { otherUnits: ["hours", "hour"] })).toEqual({ kind: "value", n: 30 });
  });
  it("afterCorrection keeps the whole text when no correction names a value", () => {
    const hasDigit = (t: string) => /\d/.test(t);
    expect(afterCorrection("30 minutes, actually 30 hours", hasDigit)).toBe(" 30 hours");
    expect(afterCorrection("30 minutes, which is actually plenty", hasDigit)).toBe("30 minutes, which is actually plenty");
  });
  it("negationReadings splits kept and said words", () => {
    expect(negationReadings("I won't book 30 minutes")).toEqual({ kept: "i", said: "i book 30 minutes" });
    expect(negationReadings("30 minutes")).toBeNull();
  });
  it("readSlot marks a value said only inside a negation", () => {
    expect(readSlot(fact(S3, "duration"), "don't schedule the 30 minute call").polarity).toBe("negated");
    expect(readSlot(fact(S3, "day"), "Wednesday, not Tuesday").polarity).toBe("affirmed");
  });
});
