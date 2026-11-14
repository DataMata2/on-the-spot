// Drill 2 engine: the only authority on what the manager reveals and how a confirmation is graded.
// Pure and deterministic. The AI roles (extractor, character) only feed it quotes and phrase its lines.

import {
  afterCorrection,
  clockToMinutes,
  hasPhrase,
  matchTime,
  negationReadings,
  normaliseText,
  parseNumber,
  readNumber,
  parseTime,
  parseWeekday,
  readParts,
  stripNegated,
  timeRelation,
  type TimeRelation,
} from "./normalise";
import type {
  DrillState,
  ExtractedFields,
  ExtractedTurn,
  Fact,
  FactCheck,
  FactGrade,
  FactReason,
  FactStatus,
  Grade,
  Scenario,
  Slot,
  TurnResult,
} from "./types";

/** Every graded fact: hidden first, then visible. */
export function allFacts(s: Scenario): { fact: Fact; hidden: boolean }[] {
  return [...s.hiddenFacts.map((fact) => ({ fact, hidden: true })), ...s.visibleFacts.map((fact) => ({ fact, hidden: false }))];
}

export function createState(s: Scenario): DrillState {
  return {
    scenarioId: s.id,
    version: s.version,
    revealed: [],
    turns: 0,
    questionsAsked: 0,
    offTopicQuestions: 0,
    hintsUsed: 0,
    changeFired: false,
  };
}

/** The fact as it stands now: after a fired condition change, its value and reveal line are the new ones. */
export function effectiveFact(s: Scenario, state: DrillState, fact: Fact): { fact: Fact; outdated: FactCheck | null } {
  const ch = s.change;
  if (!ch || !state.changeFired || ch.factKey !== fact.key) return { fact, outdated: null };
  const check = { ...fact.check, value: ch.value } as FactCheck;
  return { fact: { ...fact, check, display: ch.display, revealLine: ch.revealLine }, outdated: fact.check };
}

/** Fire the condition change if it is due (or `force`). Returns the announcement, or null. */
export function fireChangeIfDue(s: Scenario, state: DrillState, force = false): { state: DrillState; line: string | null } {
  const ch = s.change;
  if (!ch || state.changeFired || (!force && state.turns < ch.fireOnTurn)) return { state, line: null };
  const isHidden = s.hiddenFacts.some((f) => f.key === ch.factKey);
  const revealed = isHidden && !state.revealed.includes(ch.factKey) ? [...state.revealed, ch.factKey] : state.revealed;
  return { state: { ...state, changeFired: true, revealed }, line: ch.announceLine };
}

/** The manager's reply when the user's turn sounds like a confirmation. */
export const SUGGEST_CONFIRM_REPLY = "Sounds like you've got it. Tap “Confirm the task” and say it all back to me.";

const NOT_MY_TASK = [
  "Good question, but that's not what I need here.",
  "Hm, that's not really part of this one.",
  "Don't worry about that for this task.",
];

/** Deterministic reply when the engine allowed nothing (rotates with the turn count). */
export function offTopicReply(turns: number): string {
  return NOT_MY_TASK[turns % NOT_MY_TASK.length];
}

/** Said after the change when the user tried to confirm before it fired: they must confirm again. */
export const CONFIRM_AGAIN_LINE = "Can you say it back to me again with that?";

/**
 * Before a confirmation is graded, a condition change that hasn't fired yet fires now (the user confirmed
 * before any turn). Returns the manager's reply (the change, then a request to confirm again) and the new
 * state, or null when there is nothing pending and the confirmation can be graded. Not counted as a turn.
 */
export function changeBeforeConfirm(s: Scenario, state: DrillState): { state: DrillState; reply: string } | null {
  if (!s.change || state.changeFired) return null;
  const fired = fireChangeIfDue(s, state, true);
  return { state: fired.state, reply: `${fired.line} ${CONFIRM_AGAIN_LINE}` };
}

/**
 * One user turn. A question reveals ONLY the facts its topics unlock; anything else reveals nothing. Topic keys
 * the scenario doesn't know are ignored. The extracted turn cannot change the answer key: there is no input for it.
 */
export function revealFor(s: Scenario, state: DrillState, turn: ExtractedTurn): TurnResult {
  const known = new Set(s.topics.map((t) => t.key));
  const topics = [...new Set(turn.topics.filter((t) => known.has(t)))];
  const isQuestion = turn.intent === "question";
  let next: DrillState = { ...state, turns: state.turns + 1, questionsAsked: state.questionsAsked + (isQuestion ? 1 : 0) };

  const lines: string[] = [];
  const newlyRevealed: string[] = [];
  if (isQuestion) {
    for (const topicKey of topics) {
      const facts = allFacts(s).filter(({ fact }) => fact.topics.includes(topicKey));
      for (const { fact, hidden } of facts) {
        lines.push(effectiveFact(s, next, fact).fact.revealLine);
        if (hidden && !next.revealed.includes(fact.key) && !newlyRevealed.includes(fact.key)) newlyRevealed.push(fact.key);
      }
      const topic = s.topics.find((t) => t.key === topicKey);
      if (!facts.length && topic?.line) lines.push(topic.line);
    }
  }
  const allowedLines = [...new Set(lines)];
  const offTopic = isQuestion && allowedLines.length === 0;
  next = {
    ...next,
    revealed: [...next.revealed, ...newlyRevealed],
    offTopicQuestions: next.offTopicQuestions + (offTopic ? 1 : 0),
  };

  const fired = fireChangeIfDue(s, next);
  next = fired.state;
  if (fired.line) allowedLines.push(fired.line);
  return { state: next, newlyRevealed, allowedLines, changeLine: fired.line, offTopic };
}

/** A hint toward the next unrevealed hidden fact. Using one marks the run "with help". */
export function useHint(s: Scenario, state: DrillState): { state: DrillState; hint: string | null } {
  const fact = s.hiddenFacts.find((f) => !state.revealed.includes(f.key));
  if (!fact) return { state, hint: null };
  return { state: { ...state, hintsUsed: state.hintsUsed + 1 }, hint: fact.hint };
}

// ---------- grading ----------

type Primary = "ok" | "wrong" | "wrong_unit" | "wrong_relation" | "outdated" | "ambiguous" | "none" | "skip";

/** Which end of a time range ("2 to 2:30 pm") is the fact's time: the start of a meeting, the end of a deadline. */
const rangeEnd = (relation: "by" | "at") => (relation === "by" ? "end" : "start");

/** Does the text name a value for this fact's slot (a count with a unit, a time, a day)? */
function mentionsValue(check: FactCheck, text: string): boolean {
  switch (check.kind) {
    case "number": {
      const opts = { otherUnits: check.otherUnits, bareNumberOk: check.bareNumberOk, rangeSpanMinutes: check.rangeSpanMinutes };
      const n = parseNumber(text, check.units, opts);
      if (n.kind === "value" || n.kind === "wrong_unit") return true;
      // A bare number with no unit, where the fact has units, is not this slot ("actually, 2 people").
      return n.kind === "ambiguous" && (!check.units?.length || [...check.units, ...(check.otherUnits ?? [])].some((u) => hasPhrase(text, u)));
    }
    case "time":
      return parseTime(text, { range: rangeEnd(check.relation) }).kind !== "none";
    case "weekday":
      return parseWeekday(text).kind !== "none";
    case "parts":
      return false;
  }
}

/**
 * The words a value slot is read from. A self-correction ("30 minutes, actually 30 hours") leaves the corrected
 * part; negated words are dropped ("I won't book 30 minutes"). `negated`: the value was said only inside a
 * negation, so the user said they won't (not "not mentioned").
 */
function valueText(check: FactCheck, text: string): { text: string; latest: string; negated: boolean } {
  if (check.kind === "parts") return { text, latest: text, negated: false };
  const latest = afterCorrection(text, (part) => mentionsValue(check, part));
  const neg = negationReadings(latest);
  if (!neg) return { text: latest, latest, negated: false };
  return { text: neg.kept, latest, negated: !mentionsValue(check, neg.kept) && mentionsValue(check, neg.said) };
}

/**
 * Read one fact's slot from the user's words: the entities, the time and its relation word, the number and its
 * unit, the day, and the polarity. Deterministic, from the text only; the AI and the keyword fallback both end here.
 */
export function readSlot(fact: Fact, text: string): Slot {
  const parts = fact.parts ?? [];
  const pr = parts.length ? readParts(text, parts) : null;
  const check = fact.check;
  const value = valueText(check, text);
  const slot: Slot = { evidence: text, polarity: pr?.negated.length || value.negated ? "negated" : "affirmed" };
  if (pr) {
    slot.entities = {
      present: parts.filter((p) => pr.match[p.id] === "present").map((p) => p.id),
      conflict: parts.filter((p) => pr.match[p.id] === "conflict").map((p) => p.id),
      extra: pr.extra ? pr.extra[1] : null,
    };
  }
  if (check.kind === "time") {
    const t = parseTime(value.text, { range: rangeEnd(check.relation) });
    // The relation is read on the words as said: "not before 5 pm" and "no later than" need their negators.
    slot.time = { kind: t.kind, relation: timeRelation(value.latest), ...(t.kind === "definite" ? { minutes: t.minutes } : {}) };
  } else if (check.kind === "number") {
    const { parse: n, alt } = readNumber(value.text, check.units, { otherUnits: check.otherUnits, bareNumberOk: check.bareNumberOk, rangeSpanMinutes: check.rangeSpanMinutes });
    slot.count =
      n.kind === "value"
        ? { kind: "value", value: n.n }
        : n.kind === "wrong_unit"
          ? { kind: "wrong_unit", value: n.n, unit: n.unit }
          : n.kind === "ambiguous"
            ? { kind: "ambiguous", ...(alt ? { alt: true } : {}) }
            : { kind: n.kind };
  } else if (check.kind === "weekday") {
    const d = parseWeekday(value.text);
    slot.day = d.kind === "value" ? { kind: "value", value: d.day } : { kind: d.kind };
  }
  return slot;
}

function sameValue(check: FactCheck, other: FactCheck | null, value: number | string): boolean {
  return other !== null && other.kind === check.kind && "value" in other && other.value === value;
}

/** Does the relation the user said contradict the fact's? A deadline ("by") can't be "after"; a meeting time ("at") can't be before or after. */
function relationContradicts(fact: "by" | "at", said: TimeRelation): boolean {
  if (fact === "by") return said === "after" || said === "from";
  return said === "after" || said === "before";
}

function primaryOf(check: FactCheck, slot: Slot, quote: string, outdated: FactCheck | null): Primary {
  switch (check.kind) {
    case "number": {
      const c = slot.count!;
      if (c.kind === "wrong_unit") return "wrong_unit";
      if (c.kind === "ambiguous") return "ambiguous";
      if (c.kind === "none") return "none";
      if (c.value === check.value) return "ok";
      return sameValue(check, outdated, c.value!) ? "outdated" : "wrong";
    }
    case "time": {
      const target = clockToMinutes(check.value);
      const parsed = parseTime(quote, { range: rangeEnd(check.relation) });
      const m = matchTime(parsed, target, check.bareHourOk);
      if (m === "mismatch") {
        if (outdated?.kind === "time" && matchTime(parsed, clockToMinutes(outdated.value), true) === "match") return "outdated";
        return "wrong";
      }
      if (m === "none") return "none";
      // The right hour with the wrong direction ("after 5 pm" for "before 5 pm") is a contradiction.
      if (relationContradicts(check.relation, slot.time!.relation)) return "wrong_relation";
      return m === "match" ? "ok" : "ambiguous";
    }
    case "weekday": {
      const d = slot.day!;
      if (d.kind === "ambiguous" || d.kind === "vague") return "ambiguous";
      if (d.kind === "none") return "none";
      if (d.value === check.value) return "ok";
      return sameValue(check, outdated, d.value!) ? "outdated" : "wrong";
    }
    case "parts":
      return "skip";
  }
}

const AMBIGUOUS_NOTE: Record<FactCheck["kind"], string> = {
  time: "Not clear enough to confirm: say a.m. or p.m. (or the exact time).",
  number: "Not an exact number: say how many (with the unit).",
  weekday: "Not a clear day: name the day.",
  parts: "Not clear enough to confirm.",
};

const RELATION_NOTE: Record<"by" | "at", string> = {
  by: "That's the wrong way round: it has to be done before then, not after.",
  at: "That's not the same time: it's at that time, not before or after it.",
};

/** Grade one fact from the user's own quote. The status comes only from the engine's reading of that quote. */
export function gradeFact(
  fact: Fact,
  quote: string | null,
  ctx: { hidden: boolean; revealed: boolean; outdated?: FactCheck | null },
): FactGrade {
  const q = quote?.trim() ?? "";
  const slot = q ? readSlot(fact, q) : null;
  const base = { key: fact.key, label: fact.label, expected: fact.display, hidden: ctx.hidden, quote: quote || null, source: "engine" as const, slot };
  const done = (status: FactStatus, reason: FactReason | undefined, note: string): FactGrade => {
    const guessed = status === "correct" && ctx.hidden && !ctx.revealed;
    return { ...base, status, reason, guessed, note: guessed ? "Right, but you never asked: that was a guess." : note };
  };
  if (!q || !slot) return done("missing", "not_mentioned", "You didn't say this back.");

  const primary = primaryOf(fact.check, slot, valueText(fact.check, q).text, ctx.outdated ?? null);
  const parts = fact.parts ?? [];
  const ent = slot.entities;
  const present = ent?.present.length ?? 0;
  const absentLabels = parts.filter((p) => !ent?.present.includes(p.id)).map((p) => p.label);

  if (slot.polarity === "negated") return done("contradicted", "negated", `You said you won't: “${q}”. It's ${fact.display}.`);
  if (primary === "outdated") return done("contradicted", "outdated", `That was the old plan. It changed to ${fact.display}.`);
  if (primary === "wrong") return done("contradicted", "wrong_value", `You said “${q}”, but it's ${fact.display}.`);
  if (primary === "wrong_unit") return done("contradicted", "wrong_unit", `You said “${q}”: wrong unit. It's ${fact.display}.`);
  if (primary === "wrong_relation") return done("contradicted", "wrong_relation", RELATION_NOTE[(fact.check as { relation: "by" | "at" }).relation]);
  if (ent?.extra) return done("contradicted", "conflict", `“${ent.extra}” isn't part of it: it's ${fact.display} only.`);
  if (ent?.conflict.length) return done("contradicted", "conflict", `“${q}” doesn't match: it's ${fact.display}.`);
  if (primary === "ambiguous") return done("missing", "ambiguous", AMBIGUOUS_NOTE[fact.check.kind]);

  if (primary === "skip") {
    if (present === 0) return done("missing", "not_mentioned", "You didn't say this back.");
    if (present < parts.length) return done("missing", "incomplete", `Missing: ${absentLabels.join(", ")}.`);
    return done("correct", undefined, "Confirmed.");
  }
  if (primary === "none") {
    return present > 0
      ? done("missing", "incomplete", `Missing: the ${fact.check.kind === "time" ? "time" : "exact value"}.`)
      : done("missing", "not_mentioned", "You didn't say this back.");
  }
  if (present < parts.length) return done("missing", "incomplete", `Missing: ${absentLabels.join(", ")}.`);
  return done("correct", undefined, "Confirmed.");
}

/** Normalised-whitespace, case-free substring test: is the quote really in the utterance? */
export function quoteInUtterance(quote: string, utterance: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  const q = norm(quote);
  return q.length > 0 && norm(utterance).includes(q);
}

/**
 * Grade a confirmation. `fields` holds the user's quotes per fact key ("unknown" or absent = not said); keys the
 * scenario doesn't have (like "score") are ignored. With `utterance`, a fact the extractor left unknown is
 * re-read from the whole utterance and counted only when that reading is plainly correct.
 */
export function gradeConfirmation(s: Scenario, state: DrillState, fields: ExtractedFields, opts: { utterance?: string } = {}): Grade {
  const facts = allFacts(s).map(({ fact, hidden }) => {
    const { fact: eff, outdated } = effectiveFact(s, state, fact);
    const raw = Object.prototype.hasOwnProperty.call(fields, fact.key) ? fields[fact.key] : "unknown";
    const quote = raw && raw !== "unknown" && typeof raw.evidenceQuote === "string" ? raw.evidenceQuote : null;
    const ctx = { hidden, revealed: !hidden || state.revealed.includes(fact.key), outdated };
    let g = gradeFact(eff, quote, ctx);
    if (opts.utterance) {
      const whole = gradeFact(eff, opts.utterance, ctx);
      // No quote: the whole utterance can confirm a fact, never contradict it (other facts' words are in it too).
      if (!quote && whole.status === "correct") g = whole;
      // A quote can't hide the user's own contradiction: the extractor picks the span, so "10 a.m." out of
      // "after Thursday at 10 a.m.", "Acme" out of "Acme and Globex" or "email" out of "I won't email Jenna" is
      // re-checked against the whole utterance. (The extractor found this fact, so its words are the ones read.)
      else if (quote && g.status !== "contradicted" && whole.status === "contradicted") g = whole;
      // Nor a hedge on a count: "30 minutes" out of "30 minutes or maybe 2 hours" is two lengths, not clear. (Only
      // counts: a count is read next to its unit, so another fact's words don't make it ambiguous.) Only a real
      // second length counts (its own unit, a hedge, a vague amount): a clock number beside the length ("Wednesday
      // at 2, 30 minutes") is not one (B-R12-01).
      else if (quote && g.status === "correct" && eff.check.kind === "number" && whole.reason === "ambiguous" && whole.slot?.count?.alt) g = whole;
    }
    return g;
  });
  const factsConfirmed = facts.filter((f) => f.status === "correct").length;
  const factsRevealed = s.hiddenFacts.filter((f) => state.revealed.includes(f.key)).length;
  const assisted = state.hintsUsed > 0;
  return {
    scenarioId: s.id,
    version: s.version,
    facts,
    questionsAsked: state.questionsAsked,
    offTopicQuestions: state.offTopicQuestions,
    factsRevealed,
    hiddenTotal: s.hiddenFacts.length,
    factsConfirmed,
    factsTotal: facts.length,
    hintsUsed: state.hintsUsed,
    assisted,
    mode: assisted ? "with_help" : "independent",
    allCorrect: factsConfirmed === facts.length && facts.every((f) => !f.guessed),
    lesson: s.lesson,
  };
}

// ---------- deterministic fallbacks (AI unavailable) ----------

const CONFIRM_OPENERS = ["so ", "just to confirm", "to confirm", "let me confirm", "let me read", "you want me to", "got it", "ok so", "okay so", "so you want", "so i ll", "so i will", "alright so"];
const QUESTION_OPENERS = ["what", "which", "when", "who", "whom", "how", "where", "why", "should", "do", "does", "is", "are", "can", "could", "would", "will", "did", "shall"];

/** Keyword-based intent + topics, used when the extractor fails. Conservative: unknown wording reveals nothing. */
export function fallbackExtract(s: Scenario, utterance: string): ExtractedTurn {
  const t = normaliseText(utterance);
  const first = t.split(" ")[0] ?? "";
  const isConfirm = CONFIRM_OPENERS.some((o) => `${t} `.startsWith(o)) && !utterance.trim().endsWith("?");
  const intent: ExtractedTurn["intent"] = isConfirm
    ? "confirmation"
    : utterance.includes("?") || QUESTION_OPENERS.includes(first)
      ? "question"
      : "other";
  const topics = intent === "question" ? s.topics.filter((tp) => tp.keywords.some((k) => hasPhrase(t, k))).map((tp) => tp.key) : [];
  return { intent, topics };
}

/** Numbers said in a text (for the character guard). "one" is too common to count. */
function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  const p = stripNegated(normaliseText(text)).split(" ");
  for (const tok of p) {
    const p1 = parseNumber(tok);
    if (p1.kind === "value" && p1.n !== 1) out.add(p1.n);
    const clock = /^(\d{1,2}):(\d{2})$/.exec(tok);
    if (clock) out.add(Number(clock[1]));
  }
  return out;
}

/** Calendar words: a weekday, a relative day, a month, a named time. Each one is a fact the reply could invent. */
const CALENDAR_WORDS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tue", "tues", "wed", "weds", "thu", "thur", "thurs", "fri", "sat", "sun",
  "today", "tomorrow", "tonight", "yesterday", "weekend", "week", "month",
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
  "noon", "midday", "midnight", "morning", "afternoon", "evening", "eod",
]);

/** Calendar words said in a text, plurals folded ("Tuesdays"), plus ordinals as numbers ("the 21st"). */
function calendarIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const tok of normaliseText(text).split(" ")) {
    const single = tok.length > 4 && tok.endsWith("s") && CALENDAR_WORDS.has(tok.slice(0, -1)) ? tok.slice(0, -1) : tok;
    if (CALENDAR_WORDS.has(single)) out.add(single);
    const ord = /^(\d+)(?:st|nd|rd|th)$/.exec(tok);
    if (ord) out.add(`#${ord[1]}`);
  }
  return out;
}

/**
 * Guard on the character's phrasing: no number, weekday, date or time word that the allowed lines don't contain,
 * and no value of a hidden fact that isn't revealed yet. Fails → the route sends the allowed lines verbatim.
 */
export function characterReplyIsSafe(s: Scenario, state: DrillState, reply: string, allowedLines: string[]): boolean {
  if (!reply.trim() || reply.length > 500) return false;
  const allowed = allowedLines.join(" ");
  const allowedNums = numbersIn(allowed);
  for (const n of numbersIn(reply)) if (!allowedNums.has(n)) return false;
  const allowedCalendar = calendarIn(allowed);
  for (const w of calendarIn(reply)) if (!allowedCalendar.has(w)) return false;
  for (const fact of s.hiddenFacts) {
    if (state.revealed.includes(fact.key)) continue;
    for (const part of fact.parts ?? []) {
      for (const alias of part.aliases) {
        if (normaliseText(alias).length >= 3 && hasPhrase(reply, alias) && !hasPhrase(allowed, alias)) return false;
      }
    }
  }
  return true;
}

/** What the client may see before the final grade: no hidden values, no topics, no reveal lines. */
export function publicScenario(s: Scenario) {
  return {
    id: s.id,
    version: s.version,
    title: s.title,
    managerName: s.managerName,
    managerRole: s.managerRole,
    managerLine: s.managerLine,
    context: s.context,
    hiddenCount: s.hiddenFacts.length,
    transfer: Boolean(s.transferOf),
  };
}
export type PublicScenario = ReturnType<typeof publicScenario>;
