// QA round 14. B-R14-01: a meeting moved "to 2" is moved to a clock time, and "to 2, 30 minutes" is not a hedge
// between two lengths. B-R14-02: "30 minutes, up to 45 if needed" is a soft second length: not clear. Rows ported
// from qa/B/scripts/t-engine-r14.test.ts.
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
const MINUTES = ["minutes", "minute", "mins", "min"];

describe("B-R14-01: a move to a bare hour is a clock time", () => {
  const SENTENCES: [string, string, string][] = [
    // [utterance, time span, duration span]
    ["So it's moved to 2 on Wednesday, 30 minutes, with Priya and Marco.", "to 2", "30 minutes"],
    ["So I'll push it to 2 on Wednesday, 30 minutes, with Priya and Marco.", "to 2", "30 minutes"],
    ["So I'll push it to 2, 30 minutes, Wednesday, with Priya and Marco.", "to 2", "30 minutes"],
    ["So we moved the meeting to two on Wednesday, thirty minutes, Priya and Marco.", "moved the meeting to two", "thirty minutes"],
    ["So the kickoff got bumped back to 2 on Wednesday, half an hour, Priya and Marco.", "bumped back to 2", "half an hour"],
    ["So I'll reschedule the call to 2, 30 minutes, Wednesday, Priya and Marco.", "reschedule the call to 2", "30 minutes"],
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

  it("the normalisers", () => {
    expect(parseTime("push it to 2")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
    expect(parseTime("moved to 2 on Wednesday")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
    expect(parseTime("to 2")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
    expect(parseNumber("push it to 2, 30 minutes", MINUTES)).toEqual({ kind: "value", n: 30 });
    // Not a move, or a count after the hour: no clock time.
    expect(parseTime("I'll talk to 2 people")).toEqual({ kind: "none" });
    expect(parseTime("reply to 2 of them")).toEqual({ kind: "none" });
    expect(parseTime("push it to 2 hours")).toEqual({ kind: "none" });
    expect(parseTime("send it to 2 people")).toEqual({ kind: "none" });
  });
});

describe("B-R14-01: what stays as it was", () => {
  it.each([
    "So Wednesday at 2 pm with Priya and Marco, 20 to 30 minutes.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes to an hour.",
    "So Wednesday at 2 pm with Priya and Marco, 30 or 45 minutes.",
  ])("a hedged length is still not clear: %s", (u) => {
    expect(statuses(u, spans({ duration: "30 minutes" })).duration).not.toBe("correct");
    expect(statuses(u, wholeAsEverySpan(u)).duration).not.toBe("correct");
    expect(statuses(u, {}).duration).not.toBe("correct");
  });

  it("'2 to 3 pm' is still a range, and 'at 2' still a clock time", () => {
    expect(parseTime("Wednesday 2 to 3 pm")).toEqual({ kind: "definite", minutes: 14 * 60 });
    expect(parseTime("move it to 2 to 2:30 pm")).toEqual({ kind: "definite", minutes: 14 * 60 });
    expect(parseTime("Wednesday at 2, 30 minutes")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
  });
});

describe("B-R14-02: a soft upper bound on the length needs clarifying", () => {
  describe.each([
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes, up to 45 if needed.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes or 45.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes, maybe 45.",
  ])("%s", (u) => {
    it("narrow span", () => {
      expect(statuses(u, spans({ day: "Wednesday", time: "at 2 pm", duration: "30 minutes", attendees: "Priya and Marco" })).duration).toBe("missing");
    });
    it("the whole utterance as every span", () => {
      expect(statuses(u, wholeAsEverySpan(u)).duration).toBe("missing");
    });
    it("no spans", () => {
      expect(statuses(u, {}).duration).toBe("missing");
    });
  });

  it.each([
    "So Wednesday at 2 pm with Priya and Marco, up to 30 minutes.",
    "So Wednesday at 2 pm, 30 minutes, up to 2 people besides me: Priya and Marco.",
    "So Wednesday at 2 pm with Priya and Marco, 30 minutes to go over the 2 launch risks.",
  ])("no second length: %s", (u) => {
    expect(statuses(u, spans({ duration: "30 minutes" })).duration).toBe("correct");
    expect(statuses(u, {}).duration).toBe("correct");
  });
});
