// Deterministic normalisers for drill 2: numbers, times, weekdays, sets / synonym parts. Pure functions.
// They read the user's own words; they never guess. "a couple" is not a number, and "three" is not 15:00.

import type { Part, Weekday } from "./types";

/** Lowercase, unify a.m./p.m., drop punctuation (keeping clock colons), collapse whitespace. */
export function normaliseText(input: string): string {
  let s = input.toLowerCase().replace(/[‘’ʼ]/g, "'");
  s = s.replace(/o'\s?clock/g, " oclock ");
  s = s.replace(/\b([ap])\s?\.\s?m\b\.?/g, " $1m ");
  s = s.replace(/&/g, " and ");
  s = s.replace(/(\d)(am|pm)\b/g, "$1 $2");
  s = s.replace(/[^a-z0-9:\s]/g, " ");
  s = s.replace(/(?<!\d):|:(?!\d)/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Remove negated mentions ("not Tuesday", "instead of Slack", "rather than by region"): they are not the value. */
export function stripNegated(normalised: string): string {
  return normalised
    .replace(/\b(?:not|instead of|rather than|no longer)\s+(?:(?:the|a|an|on|via|by|over|in|at|for)\s+)?\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does `phrase` occur in `text` on word boundaries? Both are normalised first. */
export function hasPhrase(text: string, phrase: string): boolean {
  const p = normaliseText(phrase);
  if (!p) return false;
  return ` ${normaliseText(text)} `.includes(` ${p} `);
}

const prepare = (text: string) => stripNegated(normaliseText(text));

// ---------- numbers ----------

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, single: 1, dozen: 12,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
/** Quantity words that name no exact number. */
const VAGUE_QUANTITY = new Set(["couple", "few", "several", "some", "handful", "bunch", "many", "multiple", "various"]);

/** Reads a number starting at token i: digits, a word, or tens + unit ("twenty five"). */
function numberAt(tokens: string[], i: number): { n: number; len: number } | null {
  const t = tokens[i];
  if (t === undefined) return null;
  if (/^\d+$/.test(t)) return { n: Number(t), len: 1 };
  if (t in TENS) {
    const next = tokens[i + 1];
    if (next && next in UNITS && UNITS[next] > 0 && UNITS[next] < 10) return { n: TENS[t] + UNITS[next], len: 2 };
    return { n: TENS[t], len: 1 };
  }
  if (t in UNITS) return { n: UNITS[t], len: 1 };
  return null;
}

export type NumberParse = { kind: "value"; n: number } | { kind: "ambiguous" } | { kind: "none" };

/** Numbers and vague quantities in a token range. */
function scanNumbers(tokens: string[], from: number, to: number): { nums: number[]; vague: boolean } {
  const nums: number[] = [];
  let vague = false;
  for (let i = Math.max(0, from); i < Math.min(tokens.length, to); i++) {
    if (VAGUE_QUANTITY.has(tokens[i])) vague = true;
    const hit = numberAt(tokens, i);
    if (hit) {
      nums.push(hit.n);
      i += hit.len - 1;
    }
  }
  return { nums, vague };
}

function decide(nums: number[], vague: boolean): NumberParse {
  const distinct = [...new Set(nums)];
  if (vague || distinct.length > 1) return { kind: "ambiguous" };
  if (distinct.length === 1) return { kind: "value", n: distinct[0] };
  return { kind: "none" };
}

/**
 * The number the user said. With `units`, the number right before a unit word wins ("3 slides", "a three-slide
 * deck"); "a couple of slides" and "two or three slides" are ambiguous. Without a unit match, every number in
 * the text counts, and two different ones are ambiguous.
 */
export function parseNumber(text: string, units: string[] = []): NumberParse {
  const spoken = prepare(text)
    .replace(/\b(?:an |one )?hour and a half\b/g, "90 minutes")
    .replace(/\b(?:a )?half (?:an )?hour\b/g, "30 minutes")
    .replace(/\b(?:a|an|one) quarter (?:of an )?hour\b/g, "15 minutes")
    .replace(/\b(?:an|one) hour\b/g, "60 minutes");
  const tokens = spoken.split(" ").filter(Boolean);
  const unitTokens = units.map((u) => normaliseText(u).split(" "));
  const nums: number[] = [];
  let vague = false;
  let found = false;
  for (let i = 0; i < tokens.length; i++) {
    for (const ut of unitTokens) {
      if (ut.every((w, k) => tokens[i + k] === w)) {
        const near = scanNumbers(tokens, i - 3, i);
        if (near.nums.length || near.vague) {
          found = true;
          nums.push(...near.nums);
          vague ||= near.vague;
        }
        break;
      }
    }
  }
  if (found) return decide(nums, vague);
  const all = scanNumbers(tokens, 0, tokens.length);
  return decide(all.nums, all.vague);
}

// ---------- times ----------

export type TimeParse =
  | { kind: "definite"; minutes: number }
  | { kind: "bare"; hour12: number; minute: number }
  | { kind: "ambiguous" }
  | { kind: "vague" }
  | { kind: "none" };

const HOUR_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const MINUTE_WORDS: [string[], number][] = [
  [["forty", "five"], 45],
  [["oh", "five"], 5],
  [["fifteen"], 15],
  [["thirty"], 30],
  [["forty"], 40],
  [["twenty"], 20],
];
const MERIDIEM: [string[], "am" | "pm"][] = [
  [["am"], "am"],
  [["pm"], "pm"],
  [["in", "the", "morning"], "am"],
  [["in", "the", "afternoon"], "pm"],
  [["in", "the", "evening"], "pm"],
  [["at", "night"], "pm"],
  [["tonight"], "pm"],
];
const TIME_PREPS = new Set(["at", "by", "before", "around", "until", "till", "til", "from", "about"]);
/** Words that make "for 3 slides" / "by 2 people" a count, not a time. */
const NOT_TIME_NEXT = new Set([
  "slides", "slide", "minutes", "minute", "mins", "min", "hours", "hour", "hrs", "people", "pages", "page", "customers",
  "days", "day", "weeks", "week", "percent", "points", "of", "items", "bullets", "charts", "plans", "x",
]);
const VAGUE_TIME = ["eod", "end of day", "end of the day", "close of business", "cob", "later today", "this afternoon", "this morning", "asap", "sometime", "morning", "afternoon"];

const startsAt = (tokens: string[], i: number, seq: string[]) => seq.every((w, k) => tokens[i + k] === w);

/** An hour (and minutes) starting at token i: "10", "10:30", "ten", "ten thirty". */
function hourAt(tokens: string[], i: number): { h: number; m: number; len: number; colon: boolean; lead0: boolean } | null {
  const t = tokens[i];
  if (t === undefined) return null;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h > 23 || m > 59) return null;
    return { h, m, len: 1, colon: true, lead0: colon[1].length === 2 && colon[1].startsWith("0") };
  }
  let h: number | null = null;
  if (/^\d{1,2}$/.test(t)) h = Number(t);
  else if (t in HOUR_WORDS) h = HOUR_WORDS[t];
  if (h === null || h > 23) return null;
  for (const [seq, m] of MINUTE_WORDS) {
    if (startsAt(tokens, i + 1, seq)) return { h, m, len: 1 + seq.length, colon: false, lead0: false };
  }
  if (/^\d{1,2}$/.test(t) && /^\d{2}$/.test(tokens[i + 1] ?? "") && Number(tokens[i + 1]) < 60 && tokens[i + 1].length === 2) {
    // "10 30" (from "10.30" or "10-30")
    return { h, m: Number(tokens[i + 1]), len: 2, colon: false, lead0: false };
  }
  return { h, m: 0, len: 1, colon: false, lead0: false };
}

function meridiemAt(tokens: string[], i: number): { mer: "am" | "pm"; len: number } | null {
  for (const [seq, mer] of MERIDIEM) if (startsAt(tokens, i, seq)) return { mer, len: seq.length };
  return null;
}

const to24 = (h12: number, m: number, mer: "am" | "pm") => ((h12 % 12) + (mer === "pm" ? 12 : 0)) * 60 + m;

/**
 * The time of day the user said. "10 am", "ten a.m.", "15:00", "noon" are definite. "ten", "at 10", "3 o'clock",
 * "10:00" are bare hours (am/pm unclear; the fact decides whether that is enough). "EOD" is vague. Two different
 * times are ambiguous.
 */
export function parseTime(text: string): TimeParse {
  const tokens = prepare(text).split(" ").filter(Boolean);
  const definite: number[] = [];
  const bare: { hour12: number; minute: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "noon" || t === "midday") {
      definite.push(720);
      continue;
    }
    if (t === "midnight") {
      definite.push(0);
      continue;
    }
    if ((t === "half" || t === "quarter") && (tokens[i + 1] === "past" || tokens[i + 1] === "to")) {
      const hr = hourAt(tokens, i + 2);
      if (hr && hr.h >= 1 && hr.h <= 12) {
        const delta = t === "half" ? 30 : 15;
        const h = tokens[i + 1] === "to" ? (hr.h === 1 ? 12 : hr.h - 1) : hr.h;
        const m = tokens[i + 1] === "to" ? 60 - delta : delta;
        const mer = meridiemAt(tokens, i + 2 + hr.len);
        if (mer) definite.push(to24(h, m, mer.mer));
        else bare.push({ hour12: h, minute: m });
        i += 2 + hr.len - 1;
        continue;
      }
    }
    const hr = hourAt(tokens, i);
    if (!hr) continue;
    const after = i + hr.len;
    const mer = meridiemAt(tokens, after);
    if (mer && hr.h >= 1 && hr.h <= 12) {
      definite.push(to24(hr.h, hr.m, mer.mer));
      i = after + mer.len - 1;
      continue;
    }
    if (hr.colon && (hr.h >= 13 || hr.h === 0 || hr.lead0)) {
      definite.push(hr.h * 60 + hr.m);
      i = after - 1;
      continue;
    }
    if (hr.h < 1 || hr.h > 12) continue;
    const oclock = tokens[after] === "oclock";
    const prep = i > 0 && TIME_PREPS.has(tokens[i - 1]);
    const whole = tokens.length === hr.len;
    const nextIsCount = NOT_TIME_NEXT.has(tokens[after] ?? "");
    if (hr.colon || oclock || whole || (prep && !nextIsCount)) {
      bare.push({ hour12: hr.h, minute: hr.m });
      i = after - 1 + (oclock ? 1 : 0);
    }
  }

  if (definite.length) {
    const distinct = [...new Set(definite)];
    if (distinct.length > 1) return { kind: "ambiguous" };
    const d = distinct[0];
    const clash = bare.some((b) => b.hour12 % 12 !== Math.floor(d / 60) % 12 || b.minute !== d % 60);
    return clash ? { kind: "ambiguous" } : { kind: "definite", minutes: d };
  }
  if (bare.length) {
    const keys = [...new Set(bare.map((b) => `${b.hour12 % 12}:${b.minute}`))];
    if (keys.length > 1) return { kind: "ambiguous" };
    return { kind: "bare", hour12: bare[0].hour12, minute: bare[0].minute };
  }
  const joined = ` ${tokens.join(" ")} `;
  if (VAGUE_TIME.some((v) => joined.includes(` ${v} `))) return { kind: "vague" };
  return { kind: "none" };
}

/** "HH:MM" → minutes after midnight. */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes after midnight → "10:00 am" style for feedback. */
export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export type TimeMatch = "match" | "ambiguous" | "mismatch" | "none";

/** Compare a parsed time with the canonical one. A bare hour matches only when `bareHourOk`; else ambiguous. */
export function matchTime(parsed: TimeParse, canonicalMinutes: number, bareHourOk: boolean): TimeMatch {
  switch (parsed.kind) {
    case "definite":
      return parsed.minutes === canonicalMinutes ? "match" : "mismatch";
    case "bare": {
      const am = (parsed.hour12 % 12) * 60 + parsed.minute;
      const fits = am === canonicalMinutes || am + 720 === canonicalMinutes;
      if (!fits) return "mismatch";
      return bareHourOk ? "match" : "ambiguous";
    }
    case "ambiguous":
    case "vague":
      return "ambiguous";
    case "none":
      return "none";
  }
}

// ---------- weekdays ----------

const DAY_WORDS: Record<string, Weekday> = {
  monday: "monday", mon: "monday",
  tuesday: "tuesday", tue: "tuesday", tues: "tuesday",
  wednesday: "wednesday", wed: "wednesday", weds: "wednesday",
  thursday: "thursday", thu: "thursday", thur: "thursday", thurs: "thursday",
  friday: "friday", fri: "friday",
  saturday: "saturday", sat: "saturday",
  sunday: "sunday", sun: "sunday",
};
const RELATIVE_DAY = ["today", "tomorrow", "tonight", "next week", "this week", "later this week", "soon"];

export type WeekdayParse = { kind: "value"; day: Weekday } | { kind: "ambiguous" } | { kind: "vague" } | { kind: "none" };

/** The weekday the user said ("Thurs", "on Thursday"). "not Tuesday, Wednesday" is Wednesday; two days are ambiguous. */
export function parseWeekday(text: string): WeekdayParse {
  // "moved from Tuesday to Wednesday" names the new day; the old one is history.
  const moved = prepare(text).replace(/\bfrom (\w+) to (\w+)\b/g, (m, a: string, b: string) => (a in DAY_WORDS && b in DAY_WORDS ? b : m));
  const tokens = moved.split(" ").filter(Boolean);
  const days = new Set<Weekday>();
  for (const t of tokens) {
    const plural = t.endsWith("s") && t.slice(0, -1) in DAY_WORDS && t.length > 4 ? t.slice(0, -1) : t;
    if (plural in DAY_WORDS) days.add(DAY_WORDS[plural]);
  }
  if (days.size > 1) return { kind: "ambiguous" };
  if (days.size === 1) return { kind: "value", day: [...days][0] };
  const joined = ` ${tokens.join(" ")} `;
  if (RELATIVE_DAY.some((r) => joined.includes(` ${r} `))) return { kind: "vague" };
  return { kind: "none" };
}

// ---------- parts, synonyms, sets ----------

export type PartMatch = "present" | "conflict" | "absent";

/** Each part: present (an alias is said), conflict (a conflicting value is said, no alias), or absent. */
export function matchParts(text: string, parts: Part[]): Record<string, PartMatch> {
  const t = ` ${prepare(text)} `;
  const has = (phrase: string) => {
    const p = normaliseText(phrase);
    return p.length > 0 && t.includes(` ${p} `);
  };
  const out: Record<string, PartMatch> = {};
  for (const part of parts) {
    if (part.aliases.some(has)) out[part.id] = "present";
    else if ((part.conflicts ?? []).some(has)) out[part.id] = "conflict";
    else out[part.id] = "absent";
  }
  return out;
}

/** The set of item ids the text names, order-free: "north and east" == "east, north". */
export function normaliseSet(text: string, items: Part[]): Set<string> {
  const m = matchParts(text, items);
  return new Set(items.filter((i) => m[i.id] === "present").map((i) => i.id));
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
