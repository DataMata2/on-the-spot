// Drill 2 engine: the only authority on what the manager reveals and how a confirmation is graded.
// Pure and deterministic. The AI roles (extractor, character) only feed it quotes and phrase its lines.

import {
  clockToMinutes,
  hasPhrase,
  matchParts,
  matchTime,
  normaliseText,
  parseNumber,
  parseTime,
  parseWeekday,
  stripNegated,
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

type Primary = "ok" | "wrong" | "outdated" | "ambiguous" | "none" | "skip";

function sameValue(check: FactCheck, other: FactCheck | null, value: number | string): boolean {
  return other !== null && other.kind === check.kind && "value" in other && other.value === value;
}

function primaryOf(check: FactCheck, quote: string, outdated: FactCheck | null): Primary {
  switch (check.kind) {
    case "number": {
      const p = parseNumber(quote, check.units);
      if (p.kind === "ambiguous") return "ambiguous";
      if (p.kind === "none") return "none";
      if (p.n === check.value) return "ok";
      return sameValue(check, outdated, p.n) ? "outdated" : "wrong";
    }
    case "time": {
      const target = clockToMinutes(check.value);
      const m = matchTime(parseTime(quote), target, check.bareHourOk);
      if (m === "match") return "ok";
      if (m === "ambiguous") return "ambiguous";
      if (m === "none") return "none";
      if (outdated?.kind === "time" && matchTime(parseTime(quote), clockToMinutes(outdated.value), true) === "match") return "outdated";
      return "wrong";
    }
    case "weekday": {
      const p = parseWeekday(quote);
      if (p.kind === "ambiguous" || p.kind === "vague") return "ambiguous";
      if (p.kind === "none") return "none";
      if (p.day === check.value) return "ok";
      return sameValue(check, outdated, p.day) ? "outdated" : "wrong";
    }
    case "parts":
      return "skip";
  }
}

const AMBIGUOUS_NOTE: Record<FactCheck["kind"], string> = {
  time: "Not clear enough to confirm: say a.m. or p.m. (or the exact time).",
  number: "Not an exact number: say how many.",
  weekday: "Not a clear day: name the day.",
  parts: "Not clear enough to confirm.",
};

/** Grade one fact from the user's own quote. */
export function gradeFact(
  fact: Fact,
  quote: string | null,
  ctx: { hidden: boolean; revealed: boolean; outdated?: FactCheck | null },
): FactGrade {
  const base = { key: fact.key, label: fact.label, expected: fact.display, hidden: ctx.hidden, quote: quote || null };
  const done = (status: FactStatus, reason: FactReason | undefined, note: string): FactGrade => {
    const guessed = status === "correct" && ctx.hidden && !ctx.revealed;
    return { ...base, status, reason, guessed, note: guessed ? "Right, but you never asked: that was a guess." : note };
  };
  const q = quote?.trim() ?? "";
  if (!q) return done("missing", "not_mentioned", "You didn't say this back.");

  const primary = primaryOf(fact.check, q, ctx.outdated ?? null);
  const parts = fact.parts ?? [];
  const pm = parts.length ? matchParts(q, parts) : {};
  const conflict = parts.some((p) => pm[p.id] === "conflict");
  const present = parts.filter((p) => pm[p.id] === "present").length;
  const absentLabels = parts.filter((p) => pm[p.id] !== "present").map((p) => p.label);

  if (primary === "outdated") return done("contradicted", "outdated", `That was the old plan. It changed to ${fact.display}.`);
  if (primary === "wrong") return done("contradicted", "wrong_value", `You said “${q}”, but it's ${fact.display}.`);
  if (conflict) return done("contradicted", "conflict", `“${q}” doesn't match: it's ${fact.display}.`);
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
    if (!quote && opts.utterance) {
      const whole = gradeFact(eff, opts.utterance, ctx);
      if (whole.status === "correct") g = { ...whole, quote: opts.utterance };
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

/**
 * Guard on the character's phrasing: no number that the allowed lines don't contain, and no value of a hidden
 * fact that isn't revealed yet. Fails → the route sends the allowed lines verbatim.
 */
export function characterReplyIsSafe(s: Scenario, state: DrillState, reply: string, allowedLines: string[]): boolean {
  if (!reply.trim() || reply.length > 500) return false;
  const allowed = allowedLines.join(" ");
  const allowedNums = numbersIn(allowed);
  for (const n of numbersIn(reply)) if (!allowedNums.has(n)) return false;
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
