import { describe, expect, it } from "vitest";
import { cleanAgenda, EXAMPLE_AGENDA, MAX_AGENDA_CHARS, normalizeRehearse, REHEARSE_COUNT, rehearseUserMessage } from "../questions";

let n = 0;
const id = () => `t${++n}`;
const q = (type: string, text: string, context = "Dana (VP Product) asks:") => ({ type, text, context });

describe("normalizeRehearse", () => {
  it("keeps valid questions with fresh rh- ids", () => {
    const out = normalizeRehearse({ questions: [q("status", "Where are we on the checkout redesign?"), q("estimate", "How long would Apple Pay take?")] }, id);
    expect(out).toHaveLength(2);
    expect(out[0].id).toMatch(/^rh-/);
    expect(out[0].type).toBe("status");
    expect(out[1].context).toBe("Dana (VP Product) asks:");
  });
  it("drops unknown types, empty or tiny text, and duplicates; fills a missing context", () => {
    const out = normalizeRehearse(
      {
        questions: [
          q("gossip", "What did you think of the party?"),
          q("status", "   "),
          q("status", "ok?"),
          q("decision", "Stripe or Adyen, what do you recommend?", ""),
          q("decision", "stripe or adyen, what do you recommend?"),
          "nope",
        ],
      },
      id,
    );
    expect(out.map((x) => x.text)).toEqual(["Stripe or Adyen, what do you recommend?"]);
    expect(out[0].context).toBe("In the meeting, someone turns to you:");
  });
  it("caps the count and the length, and collapses whitespace", () => {
    const many = Array.from({ length: 9 }, (_, i) => q("blocker", `Is anything blocking item ${i}?\n  Tell me.`));
    const out = normalizeRehearse({ questions: many }, id);
    expect(out).toHaveLength(REHEARSE_COUNT);
    expect(out[0].text).toBe("Is anything blocking item 0? Tell me.");
    const long = normalizeRehearse({ questions: [q("status", "x".repeat(1000))] }, id);
    expect(long[0].text.length).toBeLessThanOrEqual(220);
  });
  it("returns [] for junk", () => {
    expect(normalizeRehearse(null)).toEqual([]);
    expect(normalizeRehearse({ questions: "no" })).toEqual([]);
    expect(normalizeRehearse([1, 2])).toEqual([]);
  });
});

describe("agenda input", () => {
  it("cleans whitespace but keeps the list's lines", () => {
    expect(cleanAgenda("  1.  Status \r\n\r\n\r\n2.\tBudget  ")).toBe("1. Status\n\n2. Budget");
    expect(cleanAgenda(42)).toBe("");
  });
  it("the example agenda fits the cap and is wrapped as data", () => {
    expect(EXAMPLE_AGENDA.length).toBeLessThan(MAX_AGENDA_CHARS);
    expect(rehearseUserMessage("a")).toContain("<agenda>\na\n</agenda>");
    expect(rehearseUserMessage("a")).not.toContain("<role>");
    expect(rehearseUserMessage("a", "Product manager")).toContain("<role>Product manager</role>");
  });
});
