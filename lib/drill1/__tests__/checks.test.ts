import { describe, expect, it } from "vitest";
import { fillerCounts, findAnswerWord, firstSentence, looksEnglish, runChecks, sentenceCount, splitSentences, wordCount } from "../checks";

describe("splitSentences", () => {
  it("splits punctuated text", () => {
    expect(splitSentences("We're on track. QA starts Monday! Any questions?")).toEqual(["We're on track.", "QA starts Monday!", "Any questions?"]);
  });
  it("keeps decimals and abbreviations whole", () => {
    expect(splitSentences("It costs 2.5 thousand, e.g. for storage. Done.")).toEqual(["It costs 2.5 thousand, e.g. for storage.", "Done."]);
  });
  it("chunks unpunctuated speech into ~15-word sentences", () => {
    const text = Array.from({ length: 31 }, (_, i) => `w${i}`).join(" ");
    expect(splitSentences(text)).toHaveLength(3);
  });
  it("returns [] for empty input", () => {
    expect(splitSentences("   ")).toEqual([]);
    expect(sentenceCount("")).toBe(0);
  });
});

describe("wordCount", () => {
  it("counts contractions and numbers as one word", () => {
    expect(wordCount("We're done by 5.30, it's $1,200.")).toBe(6);
  });
});

describe("firstSentence / findAnswerWord", () => {
  it("finds a status phrase in the first sentence", () => {
    expect(findAnswerWord("We're on track for Friday. The API is done.")).toBe("on track");
  });
  it("ignores answer words that appear only later", () => {
    expect(findAnswerWord("So the thing about the redesign is complicated. It is done.")).toBeNull();
  });
  it("matches whole words only", () => {
    expect(findAnswerWord("Knowledge transfer is the topic.")).toBeNull(); // "no" inside "Knowledge"
    expect(findAnswerWord("No, I'm not blocked.")).toBe("no");
    expect(findAnswerWord("Honestly I'm not blocked right now.")).toBe("not blocked");
  });
  it("accepts a duration or amount as an estimate answer", () => {
    expect(findAnswerWord("About three weeks for the first version.")).toBe("three weeks");
    expect(findAnswerWord("Roughly $4,000 a month.")).toBe("$4");
  });
  it("caps the first sentence at 20 words for run-on speech", () => {
    const text = Array.from({ length: 40 }, () => "and").join(" ") + ".";
    expect(firstSentence(text).split(" ")).toHaveLength(15);
  });
  it("handles curly apostrophes", () => {
    expect(findAnswerWord("I’d recommend the first vendor.")).toBe("i'd recommend");
  });
});

describe("fillerCounts", () => {
  it("counts fillers but not 'would like' / 'looks like'", () => {
    const r = fillerCounts("Um, so basically it looks like we, uh, like, you know, would like more time. Umm.");
    expect(r.byFiller).toEqual({ um: 2, uh: 1, like: 1, "you know": 1, basically: 1 });
    expect(r.total).toBe(6);
  });
  it("does not count 'you know what'", () => {
    expect(fillerCounts("You know what, it's done.").total).toBe(0);
  });
});

describe("runChecks", () => {
  it("summarizes a typical answer", () => {
    const c = runChecks("Yes, it went out yesterday. Um, we verified it in prod. Next I'll close the ticket.");
    expect(c).toMatchObject({ words: 16, sentences: 3, punctuated: true, answerWord: "yes" });
    expect(c.fillers.total).toBe(1);
  });
  it("marks a short punctuated single sentence as punctuated", () => {
    expect(runChecks("We're on track.").punctuated).toBe(true);
    expect(runChecks("we are on track the api is done and qa starts monday then we will ship it on friday after review").punctuated).toBe(false);
  });
});

describe("looksEnglish", () => {
  it("accepts ordinary English answers, punctuated or not", () => {
    expect(looksEnglish("Yes, it went out yesterday. We verified it in prod. Next I'll close the ticket.")).toBe(true);
    expect(looksEnglish("we are on track the api is done and qa starts monday")).toBe(true);
    expect(looksEnglish("We’re blocked on the auth service until Thursday")).toBe(true);
  });
  it("rejects Spanish (Latin letters, almost no English words)", () => {
    expect(looksEnglish("Sí, vamos bien. La API está lista y el equipo de QA empieza el lunes.")).toBe(false);
    expect(looksEnglish("vamos bien la api esta lista y el equipo empieza el lunes")).toBe(false);
  });
  it("rejects mostly non-ASCII text (Cyrillic, accented)", () => {
    expect(looksEnglish("Да, мы успеваем к пятнице, API готов")).toBe(false);
    expect(looksEnglish("Ja, wir sind für Freitag gut im Plan, die API ist fertig.")).toBe(false);
  });
  it("gives short text the benefit of the doubt", () => {
    expect(looksEnglish("API listo")).toBe(true);
    expect(looksEnglish("")).toBe(true);
    expect(looksEnglish("42 3")).toBe(true);
  });
  it("is part of runChecks", () => {
    expect(runChecks("We're on track for Friday, the API is done.").english).toBe(true);
    expect(runChecks("Sí, vamos bien. La API está lista y el QA empieza el lunes.").english).toBe(false);
  });
});
