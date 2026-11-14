// Teammate QA probes for drill 2 (qa/teammate/.../adversarial-regressions-latest.test.ts, "Drill 2" block), ported
// as plain tests, plus the fixes for TM-OTS-01, -02 and -05 (qa/B/findings.md, "Teammate QA (TM)").
import { describe, expect, it } from "vitest";
import { changeBeforeConfirm, characterReplyIsSafe, createState, gradeConfirmation, readSlot, revealFor } from "../engine";
import { parseNumber, readParts, timeRelation } from "../normalise";
import { CUSTOMER_UPDATE as S2, KICKOFF_CHANGE as S3, NUMBERS_FOR_THURSDAY as S1 } from "../scenarios";
import type { ExtractedFields, Scenario } from "../types";

/** Every topic asked in one turn (as the teammate's probes do). */
function askAll(s: Scenario) {
  return revealFor(s, createState(s), { intent: "question", topics: s.topics.map((t) => t.key) }).state;
}
/** The fact graded from a quote that is also the whole utterance. */
function factStatus(s: Scenario, key: string, quote: string) {
  return gradeConfirmation(s, askAll(s), { [key]: { evidenceQuote: quote } }, { utterance: quote }).facts.find((f) => f.key === key)!;
}
const fact = (s: Scenario, key: string) => [...s.hiddenFacts, ...s.visibleFacts].find((f) => f.key === key)!;

describe("teammate probes (drill 2)", () => {
  it("D2-control-valid-complete-confirmation", () => {
    const utterance = "Three slides on Q3 churn by plan for the 10 am exec sync on Thursday.";
    expect(gradeConfirmation(S1, askAll(S1), {}, { utterance }).allCorrect).toBe(true);
  });
  it("D2-bug-complete-wrong-confirmation-not-perfect", () => {
    const g = gradeConfirmation(S2, askAll(S2), {}, { utterance: "I will email Acme and Globex and cc Jenna after 5 pm Pacific." });
    expect(g.allCorrect).toBe(false);
  });
  it("D2-bug-customer-and-conflicting-customer-not-correct", () => {
    expect(factStatus(S2, "customer", "Acme and Globex").status).not.toBe("correct");
  });
  it("D2-bug-negated-action-not-correct", () => {
    expect(factStatus(S2, "channel", "I will not send an email to Jenna").status).not.toBe("correct");
  });
  it("D2-bug-after-deadline-not-correct", () => {
    expect(factStatus(S2, "deadline", "after 5 pm Pacific").status).not.toBe("correct");
  });
  it("D2-bug-seconds-not-minutes", () => {
    expect(factStatus(S3, "duration", "30 seconds").status).not.toBe("correct");
  });
  it("D2-bug-hours-not-minutes", () => {
    expect(factStatus(S3, "duration", "30 hours").status).not.toBe("correct");
  });
  it("D2-control-empty-confirmation", () => {
    const g = gradeConfirmation(S1, askAll(S1), {}, { utterance: "" });
    expect([g.factsConfirmed, g.allCorrect]).toEqual([0, false]);
  });
  it("D2-control-only-requested-hidden-field-revealed", () => {
    expect(revealFor(S1, createState(S1), { intent: "question", topics: ["format"] }).state.revealed).toEqual(["format"]);
  });
  it("D2-control-guessing-hidden-facts-not-perfect", () => {
    const utterance = "Three slides on Q3 churn by plan for the 10 am exec sync on Thursday.";
    expect(gradeConfirmation(S1, createState(S1), {}, { utterance }).allCorrect).toBe(false);
  });
  it("D2-control-early-confirm-fires-change", () => {
    const x = changeBeforeConfirm(S3, createState(S3))!;
    expect([x.state.changeFired, x.state.turns, x.reply.includes("Wednesday")]).toEqual([true, 0, true]);
  });
  it("D2-control-old-day-is-outdated", () => {
    expect(factStatus(S3, "day", "Tuesday").reason).toBe("outdated");
  });
  it("D2-control-corrected-day-is-correct", () => {
    expect(factStatus(S3, "day", "Wednesday, not Tuesday").status).toBe("correct");
  });
  it("D2-bug-character-new-day-not-in-allowed-lines", () => {
    expect(characterReplyIsSafe(S1, askAll(S1), "Three slides on Friday, please.", ["Three slides, max. Keep it tight."])).toBe(false);
  });
});

describe("TM-OTS-01a: the direction of a deadline", () => {
  it("'after' the deadline time is contradicted; 'by', 'before', 'no later than' are fine", () => {
    for (const bad of ["after Thursday at 10 a.m.", "later than 10 am", "past 10 am", "not before 10 am"]) {
      const f = factStatus(S1, "time", bad);
      expect(f.status, bad).toBe("contradicted");
      expect(f.reason, bad).toBe("wrong_relation");
    }
    for (const ok of ["by Thursday at 10 a.m.", "before 10 am", "no later than 10 am", "for the 10 am exec sync", "at 10 am"]) {
      expect(factStatus(S1, "time", ok).status, ok).toBe("correct");
    }
    expect(factStatus(S2, "deadline", "no later than 5 pm Pacific").status).toBe("correct");
    expect(factStatus(S2, "deadline", "from 5 pm Pacific").status).toBe("contradicted");
  });
  it("the live repro: a full confirmation with 'after Thursday at 10 a.m.' is not all correct", () => {
    const utterance = "Just to confirm: three slides on Q3 churn by plan, and I'll get them to you after Thursday at 10 a.m.";
    const g = gradeConfirmation(S1, askAll(S1), {}, { utterance });
    expect(g.facts.find((f) => f.key === "time")!.status).not.toBe("correct");
    expect(g.allCorrect).toBe(false);
  });
  it("a meeting time ('at' 2 pm) is contradicted by 'before' or 'after', not by 'from'", () => {
    expect(factStatus(S3, "time", "after 2 pm").status).toBe("contradicted");
    expect(factStatus(S3, "time", "before 2 pm").status).toBe("contradicted");
    expect(factStatus(S3, "time", "from 2 pm").status).toBe("correct");
    expect(factStatus(S3, "time", "at 2 p.m.").status).toBe("correct");
  });
  it("timeRelation reads the word in front of the time, past a day and 'at'", () => {
    expect(timeRelation("after Thursday at 10 a.m.")).toBe("after");
    expect(timeRelation("by this Thursday at 10")).toBe("by");
    expect(timeRelation("no later than 5 pm")).toBe("by");
    expect(timeRelation("5 pm at the latest")).toBe("by");
    expect(timeRelation("half past ten am")).toBe("none");
    expect(timeRelation("not at 5 pm, 6 pm")).toBe("none");
  });
});

describe("TM-OTS-01b: units of a number", () => {
  it("a wrong unit is contradicted; a compatible one is correct", () => {
    for (const bad of ["30 seconds", "30 hours", "thirty secs", "for 30 days"]) {
      const f = factStatus(S3, "duration", bad);
      expect(f.status, bad).toBe("contradicted");
      expect(f.reason, bad).toBe("wrong_unit");
    }
    for (const ok of ["30 minutes", "thirty mins", "half an hour", "a 30-minute call", "30 min"]) {
      expect(factStatus(S3, "duration", ok).status, ok).toBe("correct");
    }
  });
  it("a bare number with no unit is ambiguous, unless the scenario allows it", () => {
    const f = factStatus(S3, "duration", "for 30");
    expect(f.status).toBe("missing");
    expect(f.reason).toBe("ambiguous");
    const mins = ["minutes"];
    expect(parseNumber("30", mins)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("30", mins, { bareNumberOk: true })).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("30 seconds", mins, { otherUnits: ["seconds"] })).toEqual({ kind: "wrong_unit", n: 30, unit: "seconds" });
  });
  it("the live repro: '... for 30 seconds' in a full S3 confirmation", () => {
    const utterance = "So it's Wednesday now, not Tuesday, at 2 p.m. with Priya and Marco, for 30 seconds.";
    const g = gradeConfirmation(S3, askAll(S3), {}, { utterance });
    expect(g.facts.find((f) => f.key === "duration")!.status).not.toBe("correct");
    expect(g.allCorrect).toBe(false);
    const ok = gradeConfirmation(S3, askAll(S3), {}, { utterance: utterance.replace("seconds", "minutes") });
    expect(ok.allCorrect).toBe(true);
  });
});

describe("TM-OTS-01c: the extractor's span choice can't hide a contradiction", () => {
  it("a quote that drops 'after' is re-checked against the whole utterance", () => {
    const utterance = "Three slides on Q3 churn by plan, and I'll get them to you after Thursday at 10 a.m.";
    const f: ExtractedFields = {
      metric: { evidenceQuote: "Q3 churn by plan" },
      format: { evidenceQuote: "Three slides" },
      time: { evidenceQuote: "10 a.m." },
      day: { evidenceQuote: "Thursday" },
    };
    const g = gradeConfirmation(S1, askAll(S1), f, { utterance });
    const time = g.facts.find((x) => x.key === "time")!;
    expect(time.status).toBe("contradicted");
    expect(time.reason).toBe("wrong_relation");
    expect(g.allCorrect).toBe(false);
  });
  it("a quote that drops 'and Globex' or 'not' is re-checked too", () => {
    const utterance = "So I will email Acme and Globex, but I won't cc Jenna, before 5 pm Pacific.";
    const f: ExtractedFields = {
      customer: { evidenceQuote: "Acme" },
      channel: { evidenceQuote: "email" },
      deadline: { evidenceQuote: "before 5 pm Pacific" },
    };
    const g = gradeConfirmation(S2, askAll(S2), f, { utterance });
    expect(g.facts.find((x) => x.key === "customer")!.status).toBe("contradicted");
    expect(g.facts.find((x) => x.key === "channel")!.status).toBe("contradicted");
    expect(g.facts.find((x) => x.key === "deadline")!.status).toBe("correct");
  });
  it("a model 'value' never counts, and every verdict says the engine decided", () => {
    const g = gradeConfirmation(S2, askAll(S2), { deadline: { value: "before 5 pm Pacific", evidenceQuote: "after 5 pm Pacific" } });
    const d = g.facts.find((x) => x.key === "deadline")!;
    expect(d.status).toBe("contradicted");
    expect(g.facts.every((x) => x.source === "engine")).toBe(true);
    expect(d.slot?.time).toEqual({ kind: "definite", minutes: 17 * 60, relation: "after" });
  });
  it("the slot structure is the same whether the quote came from the AI or the whole utterance (fallback)", () => {
    const utterance = "I will email Acme and cc Jenna before 5 pm Pacific.";
    const viaAi = gradeConfirmation(S2, askAll(S2), { deadline: { evidenceQuote: "before 5 pm Pacific" } }, { utterance });
    const viaFallback = gradeConfirmation(S2, askAll(S2), {}, { utterance });
    const a = viaAi.facts.find((x) => x.key === "deadline")!.slot!;
    const b = viaFallback.facts.find((x) => x.key === "deadline")!.slot!;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.time).toEqual(b.time);
    expect(viaFallback.allCorrect).toBe(true);
  });
});

describe("TM-OTS-02a: a decoy named next to the right value", () => {
  it("'Acme and Globex', 'both Acme and Globex', 'Acme, Globex' are contradicted; 'Acme, not Globex' is fine", () => {
    for (const bad of ["Acme and Globex", "both Acme and Globex", "Acme, Globex", "Globex and Acme", "Acme as well as Globex", "Acme or Globex"]) {
      const f = factStatus(S2, "customer", bad);
      expect(f.status, bad).toBe("contradicted");
      expect(f.reason, bad).toBe("conflict");
    }
    for (const ok of ["Acme, not Globex", "Acme only", "just Acme, since Globex already knows"]) {
      expect(factStatus(S2, "customer", ok).status, ok).toBe("correct");
    }
  });
  it("generalises to other facts: an extra wrong value listed with the right one", () => {
    expect(factStatus(S3, "attendees", "Priya, Marco and the team").status).toBe("contradicted");
    expect(factStatus(S1, "metric", "Q3 churn by plan and by region").status).toBe("contradicted");
    expect(factStatus(S1, "metric", "Q3 and Q2 churn by plan").status).toBe("contradicted");
    expect(factStatus(S3, "attendees", "Priya and Marco").status).toBe("correct");
    expect(readParts("Q3 vs Q2", [{ id: "q3", label: "Q3", aliases: ["q3"], conflicts: ["q2"] }]).extra).toBeNull();
  });
});

describe("TM-OTS-02b: negation of the action", () => {
  it("'I will NOT send an email to Jenna' does not confirm 'email, cc Jenna'", () => {
    const f = factStatus(S2, "channel", "I will not send an email to Jenna");
    expect(f.status).toBe("contradicted");
    expect(f.reason).toBe("negated");
    expect(f.slot?.polarity).toBe("negated");
  });
  it("won't / don't / no need to / without negate the action; 'not Slack' still only drops Slack", () => {
    for (const bad of ["I won't email Jenna", "email them, but don't cc Jenna", "email, no need to cc Jenna", "email them without copying Jenna", "I'm not going to send an email or cc Jenna"]) {
      expect(factStatus(S2, "channel", bad).status, bad).toBe("contradicted");
    }
    for (const ok of ["email, not Slack, cc the account manager", "email not slack and cc jenna", "don't worry, I'll email them and cc Jenna", "I won't forget to email and cc Jenna"]) {
      expect(factStatus(S2, "channel", ok).status, ok).toBe("correct");
    }
  });
  it("the live repro: a full S2 confirmation that refuses the email is not all correct", () => {
    const utterance = "So it's Acme, before 5 pm Pacific, and I will not send an email to Jenna.";
    const g = gradeConfirmation(S2, askAll(S2), {}, { utterance });
    expect(g.facts.find((x) => x.key === "channel")!.status).not.toBe("correct");
    expect(g.allCorrect).toBe(false);
  });
  it("readSlot reports polarity per fact", () => {
    expect(readSlot(fact(S2, "channel"), "I will email Acme and cc Jenna").polarity).toBe("affirmed");
    expect(readSlot(fact(S2, "customer"), "I will email Acme, not Globex").polarity).toBe("affirmed");
    expect(readSlot(fact(S2, "customer"), "I won't email Acme").polarity).toBe("negated");
  });
});

describe("TM-OTS-05: the manager-reply guard checks days and times", () => {
  const lines = ["Three slides, max. Keep it tight."];
  it("a weekday, a relative day, a month, a named time or a date not in the allowed lines is rejected", () => {
    const st = askAll(S1);
    for (const bad of ["Three slides on Friday, please.", "Three slides by tomorrow.", "Three slides, by noon.", "Three slides by the 21st.", "Three slides in March.", "Three slides, by Tuesdays."]) {
      expect(characterReplyIsSafe(S1, st, bad, lines), bad).toBe(false);
    }
    expect(characterReplyIsSafe(S1, st, "Three slides, max, please. Keep it tight.", lines)).toBe(true);
  });
  it("a day that is in the allowed lines is fine", () => {
    const st = askAll(S1);
    const time = [fact(S1, "time").revealLine];
    expect(characterReplyIsSafe(S1, st, "It's for Thursday's exec sync at 10 a.m., so before then.", time)).toBe(true);
    expect(characterReplyIsSafe(S1, st, "It's for the exec sync on Friday at 10 a.m.", time)).toBe(false);
    expect(characterReplyIsSafe(S1, st, "It's for the exec sync on Thursday at 11 a.m.", time)).toBe(false);
  });
});
