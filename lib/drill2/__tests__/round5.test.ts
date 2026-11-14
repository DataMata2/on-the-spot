// QA Round 5 (qa/B/findings.md): B-R5-01 clock time read as the length, B-R5-02 time ranges, B-R5-03 decimal hours.
// Right answers are graded through the keyword fallback (no extractor span), the strictest path; wrong ones from a
// quote, since the fallback alone never contradicts.
import { describe, expect, it } from "vitest";
import { createState, fireChangeIfDue, gradeConfirmation, revealFor } from "../engine";
import { parseNumber, parseTime, timeRelation } from "../normalise";
import { CUSTOMER_UPDATE as S2, KICKOFF_CHANGE as S3 } from "../scenarios";
import type { Scenario } from "../types";

/** Every topic asked, and the condition change fired (Tuesday → Wednesday). */
function ready(s: Scenario) {
  const st = revealFor(s, createState(s), { intent: "question", topics: s.topics.map((t) => t.key) }).state;
  return fireChangeIfDue(s, st, true).state;
}
const fallback = (s: Scenario, utterance: string) => gradeConfirmation(s, ready(s), {}, { utterance });
const statusOf = (s: Scenario, utterance: string, key: string) => fallback(s, utterance).facts.find((f) => f.key === key)!;
/** The fact graded from a quote that is also the whole utterance. */
const quoted = (s: Scenario, key: string, quote: string) =>
  gradeConfirmation(s, ready(s), { [key]: { evidenceQuote: quote } }, { utterance: quote }).facts.find((f) => f.key === key)!;

const mins = ["minutes", "minute", "mins", "min"];
const otherUnits = ["seconds", "second", "hours", "hour", "hrs", "hr"];

describe("B-R5-01: a clock time is not the length", () => {
  it.each([
    "So Wednesday at 2 p.m., half an hour, with Priya and Marco.",
    "So the kickoff moved to Wednesday, 2 p.m., 30 minutes, just Priya from sales and Marco from support.",
    "So Wednesday 2 p.m. for half an hour, Priya and Marco.",
    "So Wednesday at 2pm 30 minutes with Priya and Marco.",
    "So Wednesday at 14:00, 30 minutes, Priya and Marco.",
  ])("%s", (utterance) => {
    expect(fallback(S3, utterance).allCorrect).toBe(true);
  });
  it("reads the number next to the unit", () => {
    expect(parseNumber("at 2 p.m., 30 minutes", mins)).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("at 2:30 pm, 30 minutes", mins)).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("at 2 pm, 1 hour", mins, { otherUnits })).toEqual({ kind: "wrong_unit", n: 1, unit: "hour" });
  });
  it("still ambiguous: two counts, or a vague one", () => {
    expect(parseNumber("at 2 pm, 20 or 30 minutes", mins)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("at 2 pm, a few minutes", mins)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("2-3 slides", ["slides"])).toEqual({ kind: "ambiguous" });
    expect(parseNumber("two to three slides", ["slides"])).toEqual({ kind: "ambiguous" });
  });
  it("a wrong length next to a clock time is still wrong", () => {
    expect(quoted(S3, "duration", "at 2 p.m., 45 minutes").status).toBe("contradicted");
  });
});

describe("B-R5-02: a time range starting at the right time", () => {
  it.each([
    "So a call Wednesday 2 to 2:30 p.m. with Priya and Marco, 30 minutes.",
    "So Wednesday from 2 to 2:30 pm with Priya and Marco.",
    "So Wednesday 2–2:30 pm with Priya and Marco.",
    "So Wednesday 2-2:30 pm with Priya and Marco.",
    "So Wednesday between 2 and 2:30 p.m. with Priya and Marco.",
    "So Wednesday from 2 pm until 2:30, Priya and Marco.",
    "So Wednesday from 2:00 to 2:30 pm with Priya and Marco, half an hour.",
    "So Wednesday 14:00 to 14:30 with Priya and Marco.",
  ])("%s", (utterance) => {
    expect(fallback(S3, utterance).allCorrect).toBe(true);
  });
  it("the range end's am/pm applies to the start", () => {
    expect(parseTime("2 to 2:30 p.m.")).toEqual({ kind: "definite", minutes: 14 * 60 });
    expect(parseTime("2 to 2:30 p.m.", { range: "end" })).toEqual({ kind: "definite", minutes: 14 * 60 + 30 });
    expect(parseTime("11 to 12:30 pm")).toEqual({ kind: "definite", minutes: 11 * 60 });
    expect(parseTime("from 2 to 2:30")).toEqual({ kind: "bare", hour12: 2, minute: 0 });
  });
  it("a range at another time is wrong", () => {
    expect(quoted(S3, "time", "from 3 to 3:30 pm").status).toBe("contradicted");
    expect(quoted(S3, "time", "1:30 to 2 pm").status).toBe("contradicted");
  });
  it("a range of another length contradicts the length; a stated length wins", () => {
    expect(quoted(S3, "duration", "from 2 to 3 pm").status).toBe("contradicted");
    expect(statusOf(S3, "So Wednesday from 2 to 3 pm with Priya and Marco.", "time").status).toBe("correct");
    expect(statusOf(S3, "So Wednesday from 2 to 2:30 pm, 30 minutes, with Priya and Marco.", "duration").status).toBe("correct");
  });
  it("after / before a range still contradicts a meeting time", () => {
    expect(timeRelation("after 2 to 2:30 pm")).toBe("after");
    expect(quoted(S3, "time", "after 2 to 2:30 pm").reason).toBe("wrong_relation");
    expect(quoted(S3, "time", "before 2 to 2:30 pm").reason).toBe("wrong_relation");
    expect(quoted(S3, "time", "after 2 pm").reason).toBe("wrong_relation");
  });
  it("a deadline reads the range's end, and 'after' still contradicts it", () => {
    expect(quoted(S2, "deadline", "between 4 and 5 pm Pacific").status).toBe("correct");
    expect(quoted(S2, "deadline", "after 4 to 5 pm Pacific").status).toBe("contradicted");
  });
  it("a count range is not a time range", () => {
    expect(parseTime("for 2 to 3 slides")).toEqual({ kind: "none" });
  });
});

describe("B-R5-03: decimal hours", () => {
  it("0.5 hours is 30 minutes", () => {
    expect(parseNumber("for 0.5 hours", mins, { otherUnits })).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("0.5 hrs", mins, { otherUnits })).toEqual({ kind: "value", n: 30 });
    expect(parseNumber(".5 hour", mins, { otherUnits })).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("1.5 hours", mins, { otherUnits })).toEqual({ kind: "value", n: 90 });
    expect(quoted(S3, "duration", "for 0.5 hours").status).toBe("correct");
    expect(fallback(S3, "So Wednesday at 2 pm with Priya and Marco, for 0.5 hours.").allCorrect).toBe(true);
  });
  it("1.5 hours is the wrong length", () => {
    expect(quoted(S3, "duration", "for 1.5 hours").status).toBe("contradicted");
  });
});
