// Drill 2 "Clarify the vague task": shared types of the deterministic engine. Pure: no Next, no AI.

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

/** One thing a confirmation must mention, matched by aliases (word boundaries, case-free, order-free). */
export interface Part {
  id: string;
  /** Shown in feedback, e.g. "by plan". */
  label: string;
  aliases: string[];
  /** Words that mean a different value for this part ("Q2" for "Q3"): saying one is a contradiction. */
  conflicts?: string[];
}

/** How a fact's value is compared. */
export type FactCheck =
  | {
      kind: "number";
      value: number;
      /** Unit words the number goes with ("slides", "minutes"). */
      units?: string[];
      /** Units of a different size ("seconds", "hours"): the number said with one of them is wrong. */
      otherUnits?: string[];
      /** A bare number with no unit counts. Default false: with `units`, "30" alone is ambiguous. */
      bareNumberOk?: boolean;
    }
  | {
      kind: "time";
      /** Canonical 24-hour "HH:MM". */
      value: string;
      /**
       * True when a bare hour ("ten", "at 10") is unambiguous in this scenario (a 10 pm exec sync makes no sense).
       * False: the user must make am/pm clear, or the fact stays unconfirmed. Never guess "three" means 15:00.
       */
      bareHourOk: boolean;
      /**
       * "by": a deadline. "before"/"by"/"no later than" fit; "after"/"later than"/"past"/"from" contradict.
       * "at": a meeting time. "after" and "before" contradict; "by" and "from" are let through.
       */
      relation: "by" | "at";
    }
  | { kind: "weekday"; value: Weekday }
  /** A set or a text value: every part must be present, in any order. */
  | { kind: "parts" };

export interface Fact {
  key: string;
  label: string;
  /** The canonical value as shown on the result card. */
  display: string;
  check: FactCheck;
  /** Extra parts that must be present (all kinds); for kind "parts" they are the whole value. */
  parts?: Part[];
  /** What the manager says when asked about it (the only text the character may use). */
  revealLine: string;
  /** Question topics that unlock this fact. */
  topics: string[];
  /** A nudge for a hint ("Ask which numbers they mean"). Using it marks the run "with help". */
  hint: string;
  /** For the extractor: what kind of detail this is, WITHOUT the value ("the time of the meeting"). */
  askLabel: string;
}

/** A question topic the extractor can tag; the engine maps topics to facts. */
export interface Topic {
  key: string;
  /** For the extractor: what a question on this topic asks about. */
  description: string;
  /** Keywords for the deterministic fallback when the AI is unavailable. */
  keywords: string[];
  /** A topic with no hidden fact: the manager's ungraded answer (so a fair question never gets "not my task"). */
  line?: string;
}

/** The manager clearly changes one detail mid-way (scenario C). */
export interface ConditionChange {
  factKey: string;
  /** The new check value (same kind as the fact's check). */
  value: number | string;
  display: string;
  /** Said once, right when the change fires. */
  announceLine: string;
  /** The fact's reveal line after the change. */
  revealLine: string;
  /** Fires at the end of this user turn (1 = the first turn). */
  fireOnTurn: number;
}

export interface Scenario {
  id: string;
  version: number;
  title: string;
  managerName: string;
  managerRole: string;
  /** The vague task, read aloud. */
  managerLine: string;
  /** Visible background for the user. Never contains hidden values. */
  context: string;
  hiddenFacts: Fact[];
  /** Facts already said in the manager line; still graded in the confirmation. */
  visibleFacts: Fact[];
  topics: Topic[];
  change?: ConditionChange;
  /** Id of the scenario this one transfers the skill from. */
  transferOf?: string;
  /** The micro-lesson shown with the result. */
  lesson: { construction: string; example: string };
}

export type FactStatus = "correct" | "missing" | "contradicted";
export type FactReason =
  | "not_mentioned"
  | "ambiguous"
  | "incomplete"
  | "wrong_value"
  | "wrong_unit"
  | "wrong_relation"
  | "outdated"
  | "conflict"
  | "negated";

/**
 * What the engine read from the user's words for one fact. Built by the engine (lib/drill2/engine.ts readSlot)
 * from an evidence quote, never from a model's own value or label, and the same whether the quote came from the
 * AI extractor or from the whole utterance (keyword fallback).
 */
export interface Slot {
  /** The user's words this reading rests on. */
  evidence: string;
  /** "negated" when the user negates the fact's own value ("I will not send an email to Jenna"). */
  polarity: "affirmed" | "negated";
  /** Parts named (ids), and a conflicting value named next to a right one ("Acme and Globex"). */
  entities?: { present: string[]; conflict: string[]; extra: string | null };
  /** The time read, and the relation word in front of it ("after", "by"). */
  time?: { kind: "definite" | "bare" | "ambiguous" | "vague" | "none"; minutes?: number; relation: "before" | "by" | "after" | "from" | "none" };
  /** The number read, and whether its unit fits ("30 seconds" for minutes is "wrong"). */
  count?: { kind: "value" | "wrong_unit" | "ambiguous" | "none"; value?: number; unit?: string };
  day?: { kind: "value" | "ambiguous" | "vague" | "none"; value?: Weekday };
}

export interface FactGrade {
  key: string;
  label: string;
  expected: string;
  hidden: boolean;
  status: FactStatus;
  reason?: FactReason;
  /** The user's own words this grade rests on. */
  quote: string | null;
  /** Hidden, never revealed, yet confirmed correctly: luck, not clarification. */
  guessed: boolean;
  /** One short line of feedback. */
  note: string;
  /** Who decided this status: always the deterministic engine, never a model. */
  source: "engine";
  /** What the engine read from `quote`. */
  slot: Slot | null;
}

export interface Grade {
  scenarioId: string;
  version: number;
  facts: FactGrade[];
  questionsAsked: number;
  offTopicQuestions: number;
  factsRevealed: number;
  hiddenTotal: number;
  factsConfirmed: number;
  factsTotal: number;
  hintsUsed: number;
  assisted: boolean;
  mode: "independent" | "with_help";
  allCorrect: boolean;
  lesson: { construction: string; example: string };
}

/** What the extractor (or the fallback) says one utterance is. Values are the user's own quotes. */
export interface ExtractedTurn {
  intent: "question" | "confirmation" | "other";
  topics: string[];
}

/** Per fact key: the user's quote, or "unknown". Unknown keys are ignored by the engine. */
export type ExtractedFields = Record<string, { value?: string; evidenceQuote: string } | "unknown">;

export interface DrillState {
  scenarioId: string;
  version: number;
  revealed: string[];
  turns: number;
  questionsAsked: number;
  offTopicQuestions: number;
  hintsUsed: number;
  changeFired: boolean;
}

export interface TurnResult {
  state: DrillState;
  /** Fact keys revealed for the first time this turn. */
  newlyRevealed: string[];
  /** The only lines the character may use this turn, in order. */
  allowedLines: string[];
  /** The condition-change announcement, if it fired this turn (also the last allowed line). */
  changeLine: string | null;
  offTopic: boolean;
}
