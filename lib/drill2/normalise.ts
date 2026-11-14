// Deterministic normalisers for drill 2: numbers, times, weekdays, sets / synonym parts. Pure functions.
// They read the user's own words; they never guess. "a couple" is not a number, and "three" is not 15:00.

import type { Part, Weekday } from "./types";

/** Lowercase, unify a.m./p.m., drop punctuation (keeping clock colons), collapse whitespace. */
export function normaliseText(input: string): string {
  let s = input.toLowerCase().replace(/[‘’ʼ]/g, "'");
  s = s.replace(/o'\s?clock/g, " oclock ");
  s = s.replace(/\b([ap])\s?\.\s?m\b\.?/g, " $1m ");
  s = s.replace(/&/g, " and ");
  // A time range "2–2:30 pm", "2-2:30", "2 – 3 pm": the dash is "to". A plain "2-3" stays (a count range, "10-30").
  s = s.replace(/(\d)\s*[–—]\s*(?=\d)/g, "$1 to ");
  s = s.replace(/(\d)\s*-\s*(?=\d{1,2}(?::\d{2}|\s*[ap]\s?\.?\s?m\b))/g, "$1 to ");
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

/**
 * "wrong_unit": the number goes with a unit that is not the fact's ("30 seconds" for 30 minutes). "ambiguous" also
 * covers a bare number with no unit where the fact names its units ("30" for 30 minutes).
 */
export type NumberParse = { kind: "value"; n: number } | { kind: "wrong_unit"; n: number; unit: string } | { kind: "ambiguous" } | { kind: "none" };

/** Words that make two numbers before one unit two choices ("30 or 40 minutes", "maybe 20, maybe 30 minutes"). */
const HEDGE_WORDS = new Set(["or", "maybe", "either", "perhaps", "possibly", "to"]);

/** Hedges that put a second number right after a length: "30 minutes or 45", "30 minutes, maybe 45". */
const AFTER_HEDGE = new Set(["or", "maybe", "perhaps", "possibly"]);

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

export interface NumberOptions {
  /**
   * A time range said with no length ("2 to 2:30 pm") counts as its span in minutes. Only for a length in minutes
   * that goes with a meeting time.
   */
  rangeSpanMinutes?: boolean;
  /** Units of a different size: a number said with one of them is the wrong value ("30 seconds", "30 hours"). */
  otherUnits?: string[];
  /** A bare number with no unit counts as the value (only when the scenario says so). Default: ambiguous. */
  bareNumberOk?: boolean;
}

/** Does the multi-word `phrase` (tokens) start at token i? */
function phraseAt(tokens: string[], i: number, phrase: string[]): boolean {
  return phrase.length > 0 && phrase.every((w, k) => tokens[i + k] === w);
}

/**
 * The number the user said. With `units`, the number right before a unit word wins ("3 slides", "a three-slide
 * deck"); "a couple of slides" and "two or three slides" are ambiguous. A number right before one of
 * `otherUnits` is "wrong_unit". With units and no unit said at all, a number is ambiguous unless `bareNumberOk`.
 * Without `units`, every number in the text counts, and two different ones are ambiguous.
 */
/** "0.5 hours", "1.5 hrs", ".5 h": a decimal number of hours is minutes (normalising would split "0.5" into 0 and 5). */
function decimalHours(text: string): string {
  return text.replace(/(\d*\.\d+)\s*(?:hours?|hrs?|hr|h)\b/gi, (m, x: string) => {
    const mins = Number(x) * 60;
    return Number.isInteger(mins) ? `${mins} minutes` : m;
  });
}

export function parseNumber(text: string, units: string[] = [], opts: NumberOptions = {}): NumberParse {
  return readNumber(text, units, opts).parse;
}

/**
 * parseNumber, plus `alt` on an ambiguous reading: the unclear part is a real second length, not just two numbers
 * side by side. It is another number with its own unit ("30 minutes or 2 hours", "30 minutes ... 45 minutes"),
 * numbers joined by a hedge ("30 or 40 minutes", "20 to 30 minutes"), a vague quantity ("a few minutes"), or a
 * unit whose number was taken back ("not 30 minutes", a correction). A clock hour beside the length ("Wednesday
 * at 2, 30 minutes") is not one (B-R12-01).
 */
export function readNumber(text: string, units: string[] = [], opts: NumberOptions = {}): { parse: NumberParse; alt: boolean } {
  const res = (parse: NumberParse, alt = false) => ({ parse, alt: parse.kind === "ambiguous" && alt });
  const spoken = prepare(decimalHours(text))
    .replace(/\b(?:an |one )?hour and a half\b/g, "90 minutes")
    .replace(/\b(?:a )?half (?:an )?hour\b/g, "30 minutes")
    .replace(/\b(?:a|an|one) quarter (?:of an )?hour\b/g, "15 minutes")
    .replace(/\b(?:an|one) hour\b/g, "60 minutes");
  const tokens = spoken.split(" ").filter(Boolean);
  // A clock time ("2 p.m.", "2:30", "at 2") is not the count: "at 2 p.m., 30 minutes" is 30 minutes.
  const times = scanTimes(tokens);
  const clock = new Set<number>();
  for (const t of [...times.definite, ...times.bare, ...times.ranges]) for (let k = t.start; k < t.end; k++) clock.add(k);
  const masked = tokens.map((w, k) => (clock.has(k) ? "" : w));
  const numbersNear = (from: number, to: number) => scanNumbers(masked, from, to);
  const unitTokens = units.map((u) => normaliseText(u).split(" "));
  const otherTokens = (opts.otherUnits ?? []).map((u) => normaliseText(u).split(" "));
  const nums: number[] = [];
  let vague = false;
  let found = false;
  let wrong: { n: number; unit: string } | null = null;
  let unitEnd = 0; // the number of another unit is read after the fact's last unit: "30 minutes, not 2 hours" has none
  let hedged = false; // two numbers before one unit joined by a hedge ("30 or 40 minutes")
  const perUnit: number[] = []; // the number said with each mention of the unit ("30 minutes ... 45 minutes")
  for (let i = 0; i < tokens.length; i++) {
    const ut = unitTokens.find((u) => phraseAt(tokens, i, u));
    if (ut) {
      unitEnd = i + ut.length;
      const near = numbersNear(i - 3, i);
      if (near.nums.length || near.vague) {
        found = true;
        nums.push(...near.nums);
        vague ||= near.vague;
        if (near.nums.length) perUnit.push(near.nums[near.nums.length - 1]);
        if (new Set(near.nums).size > 1 && tokens.slice(Math.max(0, i - 3), i).some((w) => HEDGE_WORDS.has(w))) hedged = true;
        // A second bare number hedged on right after the length ("30 minutes, up to 45 if needed", "30 minutes
        // or 45") is a soft second length: not clear which to book (B-R14-02).
        const said = near.nums[near.nums.length - 1];
        const j = i + ut.length;
        const from = AFTER_HEDGE.has(tokens[j]) ? j + 1 : tokens[j] === "up" && tokens[j + 1] === "to" ? j + 2 : -1;
        const second = from > 0 ? numberAt(masked, from) : null;
        if (said !== undefined && second && second.n !== said && !NOT_TIME_NEXT.has(tokens[from + second.len] ?? "")) {
          nums.push(second.n);
          hedged = true;
        }
      }
      continue;
    }
    const ot = otherTokens.find((u) => phraseAt(tokens, i, u));
    if (ot && !wrong) {
      const near = numbersNear(Math.max(i - 2, unitEnd), i);
      if (near.nums.length) wrong = { n: near.nums[near.nums.length - 1], unit: ot.join(" ") };
    }
  }
  // A length in the fact's unit and one in another unit ("30 minutes or 2 hours") are two lengths: not clear.
  if (found) {
    if (wrong) return res({ kind: "ambiguous" }, true);
    return res(decide(nums, vague), vague || hedged || new Set(perUnit).size > 1);
  }
  if (wrong) return res({ kind: "wrong_unit", ...wrong });
  if (opts.rangeSpanMinutes && times.ranges.length === 1) return res({ kind: "value", n: times.ranges[0].span });
  const all = scanNumbers(tokens, 0, tokens.length);
  const bare = decide(all.nums, all.vague);
  // No number with the unit: if the unit was said, its number was taken back ("not 30 minutes").
  const unitSaid = unitTokens.some((u) => tokens.some((_, k) => phraseAt(tokens, k, u)));
  if (units.length && !opts.bareNumberOk && bare.kind === "value") return res({ kind: "ambiguous" }, unitSaid);
  return res(bare, unitSaid || all.vague);
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
  // "at 2, 30 minutes" / "at 2, thirty minutes": a number followed by a count unit is a length, not the minutes.
  for (const [seq, m] of MINUTE_WORDS) {
    if (startsAt(tokens, i + 1, seq) && !NOT_TIME_NEXT.has(tokens[i + 1 + seq.length] ?? "")) return { h, m, len: 1 + seq.length, colon: false, lead0: false };
  }
  if (/^\d{1,2}$/.test(t) && /^\d{2}$/.test(tokens[i + 1] ?? "") && Number(tokens[i + 1]) < 60 && tokens[i + 1].length === 2 && !NOT_TIME_NEXT.has(tokens[i + 2] ?? "")) {
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
export function parseTime(text: string, opts: { range?: "start" | "end" } = {}): TimeParse {
  const tokens = prepare(text).split(" ").filter(Boolean);
  const { definite, bare, ranges } = scanTimes(tokens);
  const defs = definite.map((d) => d.minutes);
  const bares = [...bare];
  // A range ("2 to 2:30 pm") is one time: its start for a meeting time (default), its end for a deadline.
  for (const r of ranges) {
    const p = opts.range === "end" ? r.to : r.from;
    if ("minutes" in p) defs.push(p.minutes);
    else bares.push({ ...p, start: r.start, end: r.end });
  }
  return decideTime(tokens, defs, bares);
}

type BareHit = { hour12: number; minute: number; start: number; end: number };
type DefiniteHit = { minutes: number; start: number; end: number };
type RangePoint = { minutes: number } | { hour12: number; minute: number };
/** "2 to 2:30 pm", "from 2 until 2:30", "between 2 and 2:30": tokens [start, end), its two ends and span in minutes. */
type RangeHit = { from: RangePoint; to: RangePoint; span: number; start: number; end: number };

/** Words joining the two ends of a time range ("and" only after "between"). The dash is "to" after normalising. */
const RANGE_JOIN = new Set(["to", "till", "til", "until", "through", "thru"]);

type ClockPoint = { h: number; m: number; mer: "am" | "pm" | null; clock: boolean; len: number };

/** One end of a time range at token i: an hour, maybe with minutes, "o'clock" or am/pm. */
function clockPointAt(tokens: string[], i: number): ClockPoint | null {
  const hr = hourAt(tokens, i);
  if (!hr) return null;
  const after = i + hr.len;
  const mer = meridiemAt(tokens, after);
  if (mer) return hr.h >= 1 && hr.h <= 12 ? { h: hr.h, m: hr.m, mer: mer.mer, clock: true, len: hr.len + mer.len } : null;
  if (hr.colon && (hr.h >= 13 || hr.h === 0 || hr.lead0)) return { h: hr.h, m: hr.m, mer: null, clock: true, len: hr.len };
  if (hr.h < 1 || hr.h > 12) return null;
  const oclock = tokens[after] === "oclock";
  return { h: hr.h, m: hr.m, mer: null, clock: hr.colon || oclock, len: hr.len + (oclock ? 1 : 0) };
}

/** A time range starting at token i, or null. One end must be a clock time, or the range follows "from"/"between". */
function rangeAt(tokens: string[], i: number): RangeHit | null {
  const a = clockPointAt(tokens, i);
  if (!a) return null;
  const j = i + a.len;
  const between = tokens[i - 1] === "between";
  if (!(RANGE_JOIN.has(tokens[j]) || (between && tokens[j] === "and"))) return null;
  const b = clockPointAt(tokens, j + 1);
  if (!b) return null;
  const end = j + 1 + b.len;
  if (NOT_TIME_NEXT.has(tokens[end] ?? "")) return null; // "2 to 3 slides"
  if (!a.clock && !b.clock && !between && tokens[i - 1] !== "from") return null;
  // 24-hour ends (13:00) carry no meridiem: their hour is already the clock hour.
  const is24 = (p: ClockPoint) => p.mer === null && (p.h >= 13 || p.h === 0);
  let fromMin: number | null = null;
  let toMin: number | null = null;
  if (a.mer || is24(a)) fromMin = a.mer ? to24(a.h, a.m, a.mer) : a.h * 60 + a.m;
  if (b.mer || is24(b)) toMin = b.mer ? to24(b.h, b.m, b.mer) : b.h * 60 + b.m;
  // The am/pm said on one end carries to the other ("2 to 2:30 pm" starts at 2 pm; "11 to 1 pm" starts at 11 am).
  if (fromMin === null && toMin !== null) {
    fromMin = (a.h % 12) * 60 + a.m + (toMin >= 720 ? 720 : 0);
    if (fromMin > toMin) fromMin -= 720;
    if (fromMin < 0) fromMin = null;
  } else if (toMin === null && fromMin !== null) {
    toMin = (b.h % 12) * 60 + b.m + (fromMin >= 720 ? 720 : 0);
    if (toMin <= fromMin) toMin += 720;
  }
  let span: number;
  if (fromMin !== null && toMin !== null) span = toMin - fromMin;
  else {
    span = ((b.h % 12) * 60 + b.m - ((a.h % 12) * 60 + a.m) + 720) % 720;
  }
  if (span <= 0 || span > 720) return null;
  const point = (p: ClockPoint, min: number | null): RangePoint => (min !== null && min < 1440 ? { minutes: min } : { hour12: p.h, minute: p.m });
  return { from: point(a, fromMin), to: point(b, toMin), span, start: i, end };
}

/** Verbs that move a meeting to a new time: "push it to 2", "moved to 2 on Wednesday" (B-R14-01). */
const MOVE_VERBS = new Set([
  "move", "moved", "moving", "push", "pushed", "pushing", "change", "changed", "shift", "shifted", "bump", "bumped",
  "reschedule", "rescheduled",
]);
/** What may sit between the move verb and "to": "push it", "move the meeting back", "bump the call up". */
const MOVE_OBJECTS = [["it"], ["that"], ["the", "meeting"], ["the", "call"], ["the", "kickoff"]];
const MOVE_PARTICLES = new Set(["back", "forward", "up"]);

/**
 * Is the hour at token i the target of a move: "<move verb> [it|that|the meeting|the call|the kickoff]
 * [back|forward|up] to <hour>"? A quote of only "to <hour>" (the extractor's span for that time) counts too.
 */
function movedTo(tokens: string[], i: number): boolean {
  if (tokens[i - 1] !== "to") return false;
  if (i === 1 && tokens.length === 1 + (hourAt(tokens, i)?.len ?? 1)) return true;
  let k = i - 2;
  if (k >= 0 && MOVE_PARTICLES.has(tokens[k])) k--;
  const obj = MOVE_OBJECTS.find((o) => endsAt(tokens, k + 1, o));
  if (obj) k -= obj.length;
  return k >= 0 && MOVE_VERBS.has(tokens[k]);
}

/** Every time expression in the tokens, with the index of its first token. */
function scanTimes(tokens: string[]): { definite: DefiniteHit[]; bare: BareHit[]; ranges: RangeHit[] } {
  const definite: DefiniteHit[] = [];
  const bare: BareHit[] = [];
  const ranges: RangeHit[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "noon" || t === "midday") {
      definite.push({ minutes: 720, start: i, end: i + 1 });
      continue;
    }
    if (t === "midnight") {
      definite.push({ minutes: 0, start: i, end: i + 1 });
      continue;
    }
    if ((t === "half" || t === "quarter") && (tokens[i + 1] === "past" || tokens[i + 1] === "to")) {
      const hr = hourAt(tokens, i + 2);
      if (hr && hr.h >= 1 && hr.h <= 12) {
        const delta = t === "half" ? 30 : 15;
        const h = tokens[i + 1] === "to" ? (hr.h === 1 ? 12 : hr.h - 1) : hr.h;
        const m = tokens[i + 1] === "to" ? 60 - delta : delta;
        const mer = meridiemAt(tokens, i + 2 + hr.len);
        const end = i + 2 + hr.len + (mer ? mer.len : 0);
        if (mer) definite.push({ minutes: to24(h, m, mer.mer), start: i, end });
        else bare.push({ hour12: h, minute: m, start: i, end });
        i = end - 1;
        continue;
      }
    }
    const range = rangeAt(tokens, i);
    if (range) {
      ranges.push(range);
      i = range.end - 1;
      continue;
    }
    const hr = hourAt(tokens, i);
    if (!hr) continue;
    const after = i + hr.len;
    const mer = meridiemAt(tokens, after);
    if (mer && hr.h >= 1 && hr.h <= 12) {
      definite.push({ minutes: to24(hr.h, hr.m, mer.mer), start: i, end: after + mer.len });
      i = after + mer.len - 1;
      continue;
    }
    if (hr.colon && (hr.h >= 13 || hr.h === 0 || hr.lead0)) {
      definite.push({ minutes: hr.h * 60 + hr.m, start: i, end: after });
      i = after - 1;
      continue;
    }
    if (hr.h < 1 || hr.h > 12) continue;
    const oclock = tokens[after] === "oclock";
    // "at 2", a bare hour right after a day ("Wednesday 2, 30 minutes") and a move to an hour ("push it to 2",
    // "moved to 2 on Wednesday") are a clock time.
    const prep = i > 0 && (TIME_PREPS.has(tokens[i - 1]) || tokens[i - 1] in DAY_WORDS || movedTo(tokens, i));
    const whole = tokens.length === hr.len;
    const nextIsCount = NOT_TIME_NEXT.has(tokens[after] ?? "");
    if (hr.colon || oclock || whole || (prep && !nextIsCount)) {
      bare.push({ hour12: hr.h, minute: hr.m, start: i, end: after + (oclock ? 1 : 0) });
      i = after - 1 + (oclock ? 1 : 0);
    }
  }
  return { definite, bare, ranges };
}

function decideTime(tokens: string[], definite: number[], bare: { hour12: number; minute: number }[]): TimeParse {
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

/**
 * How the user placed the time: "before" (before, prior to, earlier than, ahead of), "by" (by, until, no later
 * than, not after), "after" (after, later than, past, since, not before), "from" (a start time: "from 2 pm"),
 * or "none" (at, for, nothing).
 */
export type TimeRelation = "before" | "by" | "after" | "from" | "none";

/** Relation phrases, longest first. They are read on the text BEFORE negated words are dropped. */
const RELATION_PHRASES: [string[], Exclude<TimeRelation, "none">][] = [
  [["no", "later", "than"], "by"],
  [["not", "later", "than"], "by"],
  [["no", "earlier", "than"], "after"],
  [["not", "earlier", "than"], "after"],
  [["later", "than"], "after"],
  [["earlier", "than"], "before"],
  [["prior", "to"], "before"],
  [["ahead", "of"], "before"],
  [["not", "before"], "after"],
  [["not", "until"], "after"],
  [["not", "till"], "after"],
  [["not", "after"], "by"],
  [["any", "time", "after"], "after"],
  [["before"], "before"],
  [["by"], "by"],
  [["until"], "by"],
  [["till"], "by"],
  [["til"], "by"],
  [["after"], "after"],
  [["past"], "after"],
  [["from"], "from"],
  [["starting"], "from"],
  [["since"], "after"],
  [["beyond"], "after"],
];
/** Words that may sit between a relation word and the time: "after Thursday at 10 a.m.", "by this Thursday at". */
const RELATION_SKIP = new Set([
  "at", "on", "this", "the", "today", "tonight", "tomorrow", "exactly", "around", "about", "roughly", "say",
  "monday", "mon", "tuesday", "tue", "tues", "wednesday", "wed", "weds", "thursday", "thu", "thur", "thurs",
  "friday", "fri", "saturday", "sat", "sunday", "sun",
]);
const CONTRAST_BEFORE = [["not"], ["instead", "of"], ["rather", "than"], ["no", "longer"]];

const endsAt = (tokens: string[], end: number, seq: string[]) => end - seq.length >= 0 && seq.every((w, k) => tokens[end - seq.length + k] === w);

/**
 * The relation word in front of the time(s) the user said. "after Thursday at 10 a.m." is "after"; a time said
 * as a negated alternative ("not at 5 pm") doesn't count. When times disagree, "after" wins over "before" over
 * "by": a direction that contradicts the fact must not be hidden by another time.
 */
export function timeRelation(text: string): TimeRelation {
  const tokens = normaliseText(text).split(" ").filter(Boolean);
  const { definite, bare, ranges } = scanTimes(tokens);
  const starts = [...definite, ...bare, ...ranges].map((t) => t.start);
  const found = new Set<TimeRelation>();
  for (const start of starts) {
    let end = start;
    for (let k = 0; k < 4 && end > 0 && RELATION_SKIP.has(tokens[end - 1]); k++) end--;
    const rel = RELATION_PHRASES.find(([seq]) => endsAt(tokens, end, seq));
    if (rel) {
      found.add(rel[1]);
      continue;
    }
    if (CONTRAST_BEFORE.some((seq) => endsAt(tokens, end, seq))) continue; // "not at 5 pm": not the value
    // "5 pm at the latest" / "at the earliest" come after the time.
    const tail = tokens.slice(start, start + 6).join(" ");
    if (/ at the earliest\b/.test(` ${tail}`)) found.add("after");
    else if (/ at the latest\b/.test(` ${tail}`)) found.add("by");
    else found.add("none");
  }
  for (const r of ["after", "from", "before", "by"] as const) if (found.has(r)) return r;
  return "none";
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

/**
 * Words with a boundary kept: "," and "|" (sentence end, ";", a dash) are tokens, so a negation's scope can stop
 * at them. Everything else is normalised as in normaliseText.
 */
export function boundaryTokens(input: string): string[] {
  const s = input
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/o'\s?clock/g, " oclock ")
    .replace(/\b([ap])\s?\.\s?m\b\.?/g, " $1m ");
  const out: string[] = [];
  for (const piece of s.split(/((?<!\d)\.(?!\d)|[;!?]|\s[-–—]\s|[–—]|,)/)) {
    if (!piece) continue;
    if (piece === ",") out.push(",");
    else if (/^(?:\.|[;!?]|\s[-–—]\s|[–—])$/.test(piece)) out.push("|");
    else out.push(...normaliseText(piece).split(" ").filter(Boolean));
  }
  return out;
}

/** Contractions arrive as two tokens after normalising: "won't" → "won t". */
const NEG_CONTRACTED = new Set(["won", "don", "doesn", "didn", "can", "shouldn", "isn", "aren", "wasn", "weren", "wouldn", "couldn", "mustn", "haven", "hasn"]);
const NEG_WORDS = new Set(["not", "never", "without", "cannot", "dont", "wont", "doesnt", "didnt", "cant", "shouldnt", "nor"]);
const CONTRAST_PHRASES = [["instead", "of"], ["rather", "than"], ["no", "longer"], ["other", "than"]];
/** Words between a negator and its verb: "won't be sending", "no need to cc". */
const NEG_SKIP = new Set(["i", "we", "you", "ll", "will", "be", "going", "gonna", "to", "need", "have", "want", "wanna", "just", "even", "also", "actually", "really", "ever", "then", "should", "it", "them"]);
/** Verbs of doing the task: a negated one negates what follows it ("I will not send an email to Jenna"). */
const ACTION_VERBS = new Set([
  "send", "sending", "sent", "email", "emailing", "emailed", "mail", "mailing", "cc", "ccing", "ccd", "copy", "copying", "include", "including", "invite", "inviting",
  "loop", "looping", "add", "adding", "tell", "telling", "contact", "contacting", "notify", "notifying", "reach",
  "write", "writing", "use", "using", "schedule", "scheduling", "book", "booking", "set", "setting", "make",
  "making", "do", "doing", "ping", "pinging", "forward", "forwarding", "share", "sharing", "put", "prepare",
  "preparing", "present", "presenting", "update", "updating",
]);
const NEG_LEAD = new Set(["the", "a", "an", "on", "via", "by", "over", "in", "at", "for", "to", "with", "any", "just"]);
/** A verbal negation's scope also stops at "and"/"or" that starts a new action ("and will email Jenna"). */
const NEW_ACTION = new Set(["i", "we", "will", "ll", "then", "instead", "also", "just", ...ACTION_VERBS]);
const VERBAL_SCOPE = 6;

/** The negator starting at token i: the index right after it, or -1. "no later than" is a relation, not a negator. */
function negatorAt(t: string[], i: number): number {
  const w = t[i];
  if (NEG_WORDS.has(w)) return i + 1;
  if (NEG_CONTRACTED.has(w) && t[i + 1] === "t") return i + 2;
  if (w === "no" && t[i + 1] !== "later" && t[i + 1] !== "earlier" && t[i + 1] !== "longer") return i + 1;
  for (const seq of CONTRAST_PHRASES) if (seq.every((x, k) => t[i + k] === x)) return i + seq.length;
  return -1;
}

const isBoundary = (w: string | undefined) => w === undefined || w === "," || w === "|" || w === "but";

/**
 * Indices of negated tokens. A negated action verb negates its object ("won't send an email to Jenna": send … jenna,
 * up to the next comma, sentence end, "but", or a new action). Otherwise only the negated value is dropped: the
 * longest of `phrases` there ("not by region"), else one word ("not Tuesday", "instead of Slack").
 */
export function negatedTokens(t: string[], phrases: string[][] = []): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < t.length; i++) {
    const after = negatorAt(t, i);
    if (after < 0) continue;
    let j = after;
    while (j < t.length && NEG_SKIP.has(t[j])) j++;
    if (ACTION_VERBS.has(t[j] ?? "")) {
      for (let k = j; k < t.length && k < j + VERBAL_SCOPE; k++) {
        if (isBoundary(t[k])) break;
        if (k > j && (t[k] === "and" || t[k] === "or") && NEW_ACTION.has(t[k + 1] ?? "")) break;
        out.add(k);
      }
      continue;
    }
    j = after;
    const longest = (at: number) => Math.max(0, ...phrases.filter((p) => p.every((x, k) => t[at + k] === x)).map((p) => p.length));
    let len = longest(j);
    while (!len && NEG_LEAD.has(t[j] ?? "")) {
      j++;
      len = longest(j);
    }
    if (isBoundary(t[j])) continue;
    for (let k = after; k < j + Math.max(1, len); k++) out.add(k);
  }
  return out;
}

/**
 * The words of `text` with negated ones dropped (`kept`: "I won't book 30 minutes" → "i"), and with only the negator
 * words dropped (`said`: "i book 30 minutes"). Null when nothing is negated. Decimal hours and time-range dashes are
 * read first, so the rebuilt text parses as the original would.
 */
export function negationReadings(text: string): { kept: string; said: string } | null {
  const pre = decimalHours(text)
    .toLowerCase()
    .replace(/\b([ap])\s?\.\s?m\b\.?/g, " $1m ")
    .replace(/(\d)\s*[–—]\s*(?=\d)/g, "$1 to ")
    .replace(/(\d)\s*-\s*(?=\d{1,2}(?::\d{2}|\s*[ap]\s?\.?\s?m\b))/g, "$1 to ");
  const t = boundaryTokens(pre);
  const neg = negatedTokens(t);
  if (!neg.size) return null;
  const negator = new Set<number>();
  for (let i = 0; i < t.length; i++) {
    const after = negatorAt(t, i);
    for (let k = i; k < after; k++) negator.add(k);
  }
  const join = (keep: (i: number) => boolean) => t.filter((_, i) => keep(i)).map((w) => (w === "|" ? "." : w)).join(" ");
  return { kept: join((i) => !neg.has(i) && !negator.has(i)), said: join((i) => !negator.has(i)) };
}

/** Words that correct what was just said: "30 minutes, actually 30 hours", "Thursday, no wait, Friday". */
const CORRECTION = /\b(?:actually|no,?\s+wait|wait|i mean|sorry|correction|or rather|scratch that|make that)\b/gi;

/**
 * A self-correction: the value said after the last correction word that is followed by one wins. Returns the text
 * after that word, or the whole text when no correction names a value for the slot (`mentions`): "30 minutes,
 * actually at 2 pm" keeps 30.
 */
export function afterCorrection(text: string, mentions: (part: string) => boolean): string {
  const cuts = [...text.matchAll(CORRECTION)].map((m) => m.index + m[0].length);
  for (const cut of cuts.reverse()) if (mentions(text.slice(cut))) return text.slice(cut);
  return text;
}

/** Fillers that join two values into one list: "Acme and Globex", "Acme, Globex", "Priya, Marco and the team". */
const LIST_JOIN = new Set(["and", "or", "plus", "also", "as", "well", "both", "the", "then", ","]);

export interface PartsReading {
  match: Record<string, PartMatch>;
  /** Parts whose own value is negated ("I will not send an email": email). */
  negated: string[];
  /** A conflicting value listed next to a right one ("Acme and Globex"): `[right alias, conflict]`. */
  extra: [string, string] | null;
}

/**
 * Read the parts of a fact from the user's words. Each part is present (an alias is said), conflict (a conflicting
 * value is said, no alias), or absent; negated values don't count, and a negated alias is reported in `negated`.
 * A conflict listed together with an alias (across the fact's parts) is reported in `extra`.
 */
export function readParts(text: string, parts: Part[]): PartsReading {
  const raw = boundaryTokens(text);
  const split = (x: string) => normaliseText(x).split(" ").filter(Boolean);
  const aliasList = parts.flatMap((p) => p.aliases.map((a) => ({ part: p.id, words: split(a), text: a })));
  const conflictList = parts.flatMap((p) => (p.conflicts ?? []).map((c) => ({ part: p.id, words: split(c), text: c })));
  const neg = negatedTokens(raw, [...aliasList, ...conflictList].map((x) => x.words).filter((w) => w.length));
  const occurrences = (words: string[]) => {
    const hits: { start: number; end: number; negated: boolean }[] = [];
    if (!words.length) return hits;
    for (let i = 0; i + words.length <= raw.length; i++) {
      if (!words.every((w, k) => raw[i + k] === w)) continue;
      const span = words.map((_, k) => i + k);
      hits.push({ start: i, end: i + words.length, negated: span.every((k) => neg.has(k)) });
    }
    return hits;
  };
  const kept = (words: string[]) => occurrences(words).filter((h) => !h.negated);

  const match: Record<string, PartMatch> = {};
  const negated = new Set<string>();
  for (const part of parts) {
    const aliases = aliasList.filter((a) => a.part === part.id);
    if (aliases.some((a) => occurrences(a.words).some((h) => h.negated))) negated.add(part.id);
    if (aliases.some((a) => kept(a.words).length)) match[part.id] = "present";
    else if (conflictList.some((c) => c.part === part.id && kept(c.words).length)) match[part.id] = "conflict";
    else match[part.id] = "absent";
  }

  let extra: [string, string] | null = null;
  const joined = (a: { start: number; end: number }, b: { start: number; end: number }) => {
    const [lo, hi] = a.end <= b.start ? [a.end, b.start] : b.end <= a.start ? [b.end, a.start] : [-1, -1];
    if (lo < 0 || hi - lo > 4) return false;
    for (let k = lo; k < hi; k++) if (!LIST_JOIN.has(raw[k])) return false;
    return true;
  };
  outer: for (const a of aliasList) {
    for (const ah of kept(a.words)) {
      for (const c of conflictList) {
        if (kept(c.words).some((ch) => joined(ah, ch))) {
          extra = [a.text, c.text];
          break outer;
        }
      }
    }
  }
  return { match, negated: [...negated], extra };
}

/** Each part: present (an alias is said), conflict (a conflicting value is said, no alias), or absent. */
export function matchParts(text: string, parts: Part[]): Record<string, PartMatch> {
  return readParts(text, parts).match;
}

/** The set of item ids the text names, order-free: "north and east" == "east, north". */
export function normaliseSet(text: string, items: Part[]): Set<string> {
  const m = matchParts(text, items);
  return new Set(items.filter((i) => m[i.id] === "present").map((i) => i.id));
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
