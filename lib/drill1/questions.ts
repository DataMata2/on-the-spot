// Drill 1 "Cold question": the question bank. Pure data + pickers; safe on client and server.
// The server is the source of truth for question text: clients send only a question id.

export type QuestionType = "status" | "decision" | "estimate" | "blocker";

export interface ColdQuestion {
  id: string;
  type: QuestionType;
  /** Who is asking and where, shown above the question. */
  context: string;
  /** The question, read aloud and shown. */
  text: string;
}

export const QUESTION_TYPES: readonly QuestionType[] = ["status", "decision", "estimate", "blocker"];

export const TYPE_LABELS: Record<QuestionType, string> = {
  status: "Status update",
  decision: "Decision / opinion",
  estimate: "Estimate",
  blocker: "Blocker",
};

/** What a good first sentence does for each type (shown as the optional hint). */
export const TYPE_HINTS: Record<QuestionType, string> = {
  status: "Lead with the status in one phrase (on track / at risk / done), then why, then what's next.",
  decision: "Lead with your pick (\"I recommend…\" / \"Yes\" / \"No\"), then one reason, then the next step.",
  estimate: "Lead with a number or a date, then your confidence and what it depends on.",
  blocker: "Lead with \"Yes, I'm blocked on…\" or \"No blockers\", then what you need and from whom.",
};

export const QUESTIONS: readonly ColdQuestion[] = [
  // Status update
  { id: "st-onboarding", type: "status", context: "Standup. Your manager asks:", text: "Quick one: where are we on the onboarding redesign?" },
  { id: "st-migration", type: "status", context: "Weekly sync. The engineering director turns to you:", text: "How's the database migration going? Are we still good for the end of the month?" },
  { id: "st-launch", type: "status", context: "Cross-team meeting. The marketing lead asks:", text: "Is the pricing page ready for the launch, or should we hold the announcement?" },
  { id: "st-bugfix", type: "status", context: "Standup. A teammate asks before you even unmute:", text: "Did the fix for the checkout bug go out yesterday?" },
  // Decision / opinion
  { id: "de-vendor", type: "decision", context: "Planning meeting. Your VP asks you directly:", text: "You've looked at both analytics vendors. Which one should we go with?" },
  { id: "de-scope", type: "decision", context: "Sprint planning. The PM asks:", text: "Should we cut the export feature to make the release date, or push the date?" },
  { id: "de-design", type: "decision", context: "Design review. The lead designer asks:", text: "Do you think the new navigation is ready to ship to everyone?" },
  { id: "de-hire", type: "decision", context: "Hiring debrief. The hiring manager asks:", text: "Would you hire this candidate for the senior role? Yes or no, and why?" },
  // Estimate
  { id: "es-feature", type: "estimate", context: "Roadmap review. Your manager asks:", text: "How long would it take your team to add single sign-on?" },
  { id: "es-dashboard", type: "estimate", context: "Customer call prep. The account lead asks:", text: "When can we realistically promise the new dashboard to this customer?" },
  { id: "es-cost", type: "estimate", context: "Budget meeting. The finance partner asks:", text: "Roughly how much will the extra cloud capacity cost us per month?" },
  { id: "es-review", type: "estimate", context: "Standup. Your tech lead asks:", text: "When will your pull request be ready for review?" },
  // Blocker
  { id: "bl-general", type: "blocker", context: "Standup. Your manager wraps up:", text: "Anything blocking you this week?" },
  { id: "bl-access", type: "blocker", context: "1:1. Your skip-level manager asks:", text: "Is there anything slowing your team down that I could help with?" },
  { id: "bl-dependency", type: "blocker", context: "Project sync. The program manager asks:", text: "Are you waiting on anything from the platform team for the integration?" },
  { id: "bl-data", type: "blocker", context: "Weekly sync. Your manager asks:", text: "The report was due Monday. What's holding it up?" },
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** The question with this id, or null. */
export function getQuestion(id: unknown): ColdQuestion | null {
  return typeof id === "string" ? (BY_ID.get(id) ?? null) : null;
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

/**
 * Pick a question of `type` (any type when omitted), avoiding `excludeIds` (the ones already seen).
 * A retry is always a different question of the same type: when every question of the type is excluded, the
 * least recent one other than the last seen is reused (never the same as the last). `rand` is injectable for tests.
 */
export function pickQuestion(type: QuestionType | null, excludeIds: readonly string[] = [], rand: () => number = Math.random): ColdQuestion {
  const pool = type ? QUESTIONS.filter((q) => q.type === type) : [...QUESTIONS];
  const excluded = new Set(excludeIds);
  let candidates = pool.filter((q) => !excluded.has(q.id));
  if (candidates.length === 0) {
    const last = excludeIds[excludeIds.length - 1];
    candidates = pool.filter((q) => q.id !== last);
    if (candidates.length === 0) candidates = pool;
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(rand() * candidates.length))];
}

/** Local calendar day "YYYY-MM-DD" for a date (the user's day, not UTC). */
export function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" string (calendar arithmetic, timezone-free). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The question type of the daily drill for a calendar day: a deterministic rotation through the four types. */
export function dailyType(day: string): QuestionType {
  const n = dayNumber(day);
  return QUESTION_TYPES[((n % QUESTION_TYPES.length) + QUESTION_TYPES.length) % QUESTION_TYPES.length];
}
