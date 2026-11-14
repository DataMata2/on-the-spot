// QA round 12, B-R12-01: a clock hour beside the length ("Wednesday at 2, 30 minutes") is not a second length. The
// whole utterance overrides a correct narrow quote on a count only for a real alternative length (its own unit, a
// hedge, a vague amount, a taken-back number). Rows ported from qa/B/scripts/r6-engine-spans.test.ts and t-engine-r12.
import { describe, expect, it } from "vitest";
import { allFacts, createState, fireChangeIfDue, gradeConfirmation, revealFor } from "../engine";
import { parseNumber, parseTime } from "../normalise";
import { KICKOFF_CHANGE as S3 } from "../scenarios";
import type { ExtractedFields, Scenario } from "../types";

function ready(s: Scenario) {
  const st = revealFor(s, createState(s), { intent: "question", topics: s.topics.map((t) => t.key) }).state;
  return fireChangeIfDue(s, st, true).state;
}
const statuses = (u: string, fields: ExtractedFields) =>
  Object.fromEntries(gradeConfirmation(S3, ready(S3), fields, { utterance: u }).facts.map((f) => [f.key, f.status]));
const spans = (q: Record<string, string>): ExtractedFields => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, { evidenceQuote: v }]));
const wholeAsEverySpan = (u: string): ExtractedFields => Object.fromEntries(allFacts(S3).map(({ fact }) => [fact.key, { evidenceQuote: u }]));
const ALL = { attendees: "correct", time: "correct", duration: "correct", day: "correct" };

describe("B-R12-01: a clock hour next to the length is not a second length", () => {
  const SENTENCES: [string, string, string][] = [
    // [utterance, time span, duration span]
    ["So Wednesday at 2, 30 minutes, with Priya and Marco.", "at 2", "30 minutes"],
    ["So Wednesday at 2, thirty minutes, with Priya and Marco.", "at 2", "thirty minutes"],
    ["So Wednesday 2 pm, half an hour, with Priya and Marco.", "2 pm", "half an hour"],
    ["So 2 pm for 30 minutes on Wednesday with Priya and Marco.", "2 pm", "for 30 minutes"],
    ["So Wednesday 2, 30 minutes, with Priya and Marco.", "2", "30 minutes"],
  ];
  describe.each(SENTENCES)("%s", (u, time, duration) => {
    it("narrow spans", () => {
      expect(statuses(u, spans({ day: "Wednesday", time, duration, attendees: "Priya and Marco" }))).toEqual(ALL);
    });
    it("the whole utterance as every span", () => {
      expect(statuses(u, wholeAsEverySpan(u))).toEqual(ALL);
    });
    it("no spans (keyword fallback)", () => {
      expect(statuses(u, {})).toEqual(ALL);
    });
  });

  it("QA r6 row: a wide time span over the length", () => {
    const u = "So Wednesday at 2, 30 minutes, with Priya and Marco.";
    expect(statuses(u, spans({ time: "Wednesday at 2, 30 minutes", duration: "30 minutes", day: "Wednesday", attendees: "Priya and Marco" }))).toEqual(ALL);
  });

  it("the normalisers read the clock and the length apart", () => {
    const units = ["minutes", "minute", "mins", "min"];
    expect(parseNumber("at 2, 30 minutes", units)).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("at 2, thirty minutes", units)).toEqual({ kind: "value", n: 30 });
    expect(parseTime("Wednesday at 2, 30 minutes")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
    // A real clock time is still read: "at 2 30" and "at two thirty" are 2:30.
    expect(parseTime("at 2 30")).toEqual({ kind: "bare", hour12: 2, minute: 30 });
    expect(parseTime("at two thirty")).toEqual({ kind: "bare", hour12: 2, minute: 30 });
  });
});

describe("B-R12-01: a real second length still overrides a narrow quote", () => {
  it.each([
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes or maybe an hour.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes or maybe 2 hours.",
    "So Wednesday at 2 pm with Priya and Marco, 20 to 30 minutes.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes, maybe 45 minutes.",
    "So Wednesday at 2 pm with Priya and Marco, not 30 minutes.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes, actually 30 hours.",
  ])("%s", (u) => {
    expect(statuses(u, spans({ duration: "30 minutes" })).duration).not.toBe("correct");
  });
});
