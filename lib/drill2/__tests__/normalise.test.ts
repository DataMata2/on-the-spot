import { describe, expect, it } from "vitest";
import {
  clockToMinutes,
  matchParts,
  matchTime,
  normaliseSet,
  normaliseText,
  parseNumber,
  parseTime,
  parseWeekday,
  setsEqual,
} from "../normalise";
import type { Part } from "../types";

describe("normaliseText", () => {
  it("unifies a.m./p.m., punctuation and case", () => {
    expect(normaliseText("Ten A.M., please!")).toBe("ten am please");
    expect(normaliseText("10am")).toBe("10 am");
    expect(normaliseText("3 o'clock")).toBe("3 oclock");
    expect(normaliseText("a three-slide deck")).toBe("a three slide deck");
    expect(normaliseText("Format: 10:00")).toBe("format 10:00");
  });
});

describe("parseNumber", () => {
  const slides = ["slides", "slide"];
  it("'three slides' == '3 slides'", () => {
    expect(parseNumber("three slides", slides)).toEqual({ kind: "value", n: 3 });
    expect(parseNumber("3 slides", slides)).toEqual({ kind: "value", n: 3 });
    expect(parseNumber("a three-slide deck", slides)).toEqual({ kind: "value", n: 3 });
    expect(parseNumber("3 short slides", slides)).toEqual({ kind: "value", n: 3 });
  });
  it("vague quantities and ranges are ambiguous, never a number", () => {
    expect(parseNumber("a couple of slides", slides)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("a few slides", slides)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("two or three slides", slides)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("2-3 slides", slides)).toEqual({ kind: "ambiguous" });
  });
  it("prefers the number next to the unit over other numbers", () => {
    expect(parseNumber("3 slides for the 10 am sync", slides)).toEqual({ kind: "value", n: 3 });
  });
  it("without a unit, two different numbers are ambiguous; none is none", () => {
    expect(parseNumber("3 or 4")).toEqual({ kind: "ambiguous" });
    expect(parseNumber("some slides", slides)).toEqual({ kind: "ambiguous" });
    expect(parseNumber("a slide deck", slides)).toEqual({ kind: "none" });
  });
  it("reads spoken durations", () => {
    const mins = ["minutes", "mins"];
    expect(parseNumber("half an hour", mins)).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("thirty minutes", mins)).toEqual({ kind: "value", n: 30 });
    expect(parseNumber("an hour", mins)).toEqual({ kind: "value", n: 60 });
    expect(parseNumber("twenty five minutes", mins)).toEqual({ kind: "value", n: 25 });
  });
  it("ignores negated numbers", () => {
    expect(parseNumber("not 5, 3 slides", slides)).toEqual({ kind: "value", n: 3 });
  });
});

describe("parseTime", () => {
  const ten = clockToMinutes("10:00");
  it("'ten a.m.' == '10 am' == '10:00 am' == 10:00", () => {
    expect(parseTime("ten a.m.")).toEqual({ kind: "definite", minutes: ten });
    expect(parseTime("10 am")).toEqual({ kind: "definite", minutes: ten });
    expect(parseTime("10am")).toEqual({ kind: "definite", minutes: ten });
    expect(parseTime("10:00 a.m.")).toEqual({ kind: "definite", minutes: ten });
    expect(parseTime("ten in the morning")).toEqual({ kind: "definite", minutes: ten });
  });
  it("'10', 'ten', 'at 10', '10:00' are bare hours (am/pm unclear)", () => {
    for (const s of ["10", "ten", "at 10", "10:00", "10 o'clock", "by ten"]) {
      expect(parseTime(s), s).toEqual({ kind: "bare", hour12: 10, minute: 0 });
    }
  });
  it("24-hour clock and pm", () => {
    expect(parseTime("15:00")).toEqual({ kind: "definite", minutes: 900 });
    expect(parseTime("before 5 p.m. Pacific")).toEqual({ kind: "definite", minutes: 1020 });
    expect(parseTime("five pm")).toEqual({ kind: "definite", minutes: 1020 });
    expect(parseTime("noon")).toEqual({ kind: "definite", minutes: 720 });
    expect(parseTime("half past ten am")).toEqual({ kind: "definite", minutes: 630 });
    expect(parseTime("ten thirty pm")).toEqual({ kind: "definite", minutes: 22 * 60 + 30 });
  });
  it("counts are not times", () => {
    expect(parseTime("for 3 slides")).toEqual({ kind: "none" });
    expect(parseTime("three slides")).toEqual({ kind: "none" });
  });
  it("vague and conflicting times are not confirmed", () => {
    expect(parseTime("end of day")).toEqual({ kind: "vague" });
    expect(parseTime("EOD")).toEqual({ kind: "vague" });
    expect(parseTime("10 am or 11 am")).toEqual({ kind: "ambiguous" });
  });
});

describe("matchTime", () => {
  it("a bare hour matches only when the scenario says the hour is unambiguous", () => {
    const ten = clockToMinutes("10:00");
    expect(matchTime(parseTime("ten"), ten, true)).toBe("match");
    expect(matchTime(parseTime("ten"), ten, false)).toBe("ambiguous");
  });
  it("never guesses that 'three' means 15:00", () => {
    expect(matchTime(parseTime("three"), clockToMinutes("15:00"), false)).toBe("ambiguous");
    expect(matchTime(parseTime("3 pm"), clockToMinutes("15:00"), false)).toBe("match");
  });
  it("a different hour is a mismatch either way", () => {
    expect(matchTime(parseTime("by three"), clockToMinutes("17:00"), false)).toBe("mismatch");
    expect(matchTime(parseTime("11 am"), clockToMinutes("10:00"), true)).toBe("mismatch");
    expect(matchTime(parseTime("10 pm"), clockToMinutes("10:00"), true)).toBe("mismatch");
  });
});

describe("parseWeekday", () => {
  it("reads full names and abbreviations", () => {
    expect(parseWeekday("on Thursday")).toEqual({ kind: "value", day: "thursday" });
    expect(parseWeekday("Thurs")).toEqual({ kind: "value", day: "thursday" });
    expect(parseWeekday("wed.")).toEqual({ kind: "value", day: "wednesday" });
  });
  it("drops negated days, flags two days and relative days", () => {
    expect(parseWeekday("not Tuesday, Wednesday")).toEqual({ kind: "value", day: "wednesday" });
    expect(parseWeekday("Tuesday or Wednesday")).toEqual({ kind: "ambiguous" });
    expect(parseWeekday("moved from Tuesday to Wednesday")).toEqual({ kind: "value", day: "wednesday" });
    expect(parseWeekday("tomorrow")).toEqual({ kind: "vague" });
    expect(parseWeekday("the deck")).toEqual({ kind: "none" });
  });
});

describe("sets and synonyms", () => {
  const walls: Part[] = [
    { id: "north", label: "north", aliases: ["north", "north wall"] },
    { id: "east", label: "east", aliases: ["east", "east wall"] },
  ];
  it("list order doesn't matter: 'north and east' == 'east, north'", () => {
    expect(setsEqual(normaliseSet("north and east", walls), normaliseSet("east, north", walls))).toBe(true);
    expect(setsEqual(normaliseSet("the east wall", walls), normaliseSet("north and east", walls))).toBe(false);
  });
  it("aliases match on word boundaries; conflicts count only without an alias", () => {
    const q3: Part[] = [{ id: "q3", label: "Q3", aliases: ["q3", "third quarter"], conflicts: ["q2"] }];
    expect(matchParts("the third quarter", q3)).toEqual({ q3: "present" });
    expect(matchParts("Q2 numbers", q3)).toEqual({ q3: "conflict" });
    expect(matchParts("Q3 vs Q2", q3)).toEqual({ q3: "present" });
    expect(matchParts("q33", q3)).toEqual({ q3: "absent" });
    expect(matchParts("not Q2", q3)).toEqual({ q3: "absent" });
  });
});
