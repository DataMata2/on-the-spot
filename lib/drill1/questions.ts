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
  /**
   * The situation, shown (never read aloud) before and while answering: who you are, then what happened and the
   * facts you have, so nobody has to invent the status of a project they don't know. Two short lines for the banks
   * and generated questions; absent for Rehearse (the user knows their own meeting). Also given to the feedback
   * model, and its numbers and days count as "said" for the stronger-version guard.
   */
  situation?: readonly string[];
}

/** The situation lines as one plain text (empty when there are none). */
export function situationText(q: Pick<ColdQuestion, "situation">): string {
  return (q.situation ?? []).join(" ").trim();
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
  status: "Lead with the status in one phrase (on track / at risk / done), then why, then what's next. If you don't know something yet, say so and say when you will.",
  decision: "Lead with your pick (\"I recommend…\" / \"Yes\" / \"No\"), then one reason, then the next step. If you can't decide yet, say what you need to decide and by when.",
  estimate: "Lead with your best number or date, then what it depends on. If you can't estimate yet, say so and say when you'll have a number.",
  blocker: "Lead with \"Yes, I'm blocked on…\" or \"No blockers\", then what you need and from whom.",
};

export const QUESTIONS: readonly ColdQuestion[] = [
  // Status update
  {
    id: "st-onboarding", type: "status", context: "Standup. Your manager asks:", text: "Quick one: where are we on the onboarding redesign?",
    situation: ["You lead the onboarding redesign.", "The new sign-up screens are built. Testing with 5 users found one confusing step; the fix ships Thursday."],
  },
  {
    id: "st-migration", type: "status", context: "Weekly sync. The engineering director turns to you:", text: "How's the database migration going? Are we still good for the end of the month?",
    situation: ["You run the database migration.", "About 80% of the tables are moved. A slow query on the orders table cost you 2 days, so the end of the month is possible but tight."],
  },
  {
    id: "st-launch", type: "status", context: "Cross-team meeting. The marketing lead asks:", text: "Is the pricing page ready for the launch, or should we hold the announcement?",
    situation: ["You own the pricing page for next week's launch.", "The page is built and approved. Legal still has to sign off on the plan names; they promised an answer by Wednesday."],
  },
  {
    id: "st-bugfix", type: "status", context: "Standup. A teammate asks before you even unmute:", text: "Did the fix for the checkout bug go out yesterday?",
    situation: ["You fixed the checkout bug where the coupon field crashed the page.", "The fix passed review, but last night's release was paused, so it goes out with today's 2 pm deploy."],
  },
  // Decision / opinion
  {
    id: "de-vendor", type: "decision", context: "Planning meeting. Your VP asks you directly:", text: "You've looked at both analytics vendors. Which one should we go with?",
    situation: ["You spent 2 weeks testing two analytics vendors, A and B.", "A is cheaper and easier to set up; B has better funnels but costs twice as much. Your team mostly needs simple dashboards."],
  },
  {
    id: "de-scope", type: "decision", context: "Sprint planning. The PM asks:", text: "Should we cut the export feature to make the release date, or push the date?",
    situation: ["You're the engineer building the export feature.", "It needs about 4 more days. The release is in 6 days, and the release also needs 3 days of testing."],
  },
  {
    id: "de-design", type: "decision", context: "Design review. The lead designer asks:", text: "Do you think the new navigation is ready to ship to everyone?",
    situation: ["You watched the usability tests of the new navigation.", "8 of 10 testers found things faster; 2 couldn't find Settings. The rollout to 10% of users had no complaints."],
  },
  {
    id: "de-hire", type: "decision", context: "Hiring debrief. The hiring manager asks:", text: "Would you hire this candidate for the senior role? Yes or no, and why?",
    situation: ["You interviewed the candidate on system design.", "Her design skills and communication were strong, but she has little experience mentoring others, which the role needs."],
  },
  // Estimate
  {
    id: "es-feature", type: "estimate", context: "Roadmap review. Your manager asks:", text: "How long would it take your team to add single sign-on?",
    situation: ["You lead a team of 4 engineers.", "Single sign-on needs a new login provider and changes to 3 apps. A similar project last year took about 6 weeks."],
  },
  {
    id: "es-dashboard", type: "estimate", context: "Customer call prep. The account lead asks:", text: "When can we realistically promise the new dashboard to this customer?",
    situation: ["Your team builds the new customer dashboard.", "The data part is done. The charts need about 3 more weeks, and QA usually takes 1 more week after that."],
  },
  {
    id: "es-cost", type: "estimate", context: "Budget meeting. The finance partner asks:", text: "Roughly how much will the extra cloud capacity cost us per month?",
    situation: ["You sized the extra cloud capacity for the new region.", "You need 4 more servers at about $500 each per month, plus some storage you haven't priced yet."],
  },
  {
    id: "es-review", type: "estimate", context: "Standup. Your tech lead asks:", text: "When will your pull request be ready for review?",
    situation: ["You're working on the pull request for the search filters.", "The code is done, but 2 tests still fail. You expect to fix them this afternoon."],
  },
  // Blocker
  {
    id: "bl-general", type: "blocker", context: "Standup. Your manager wraps up:", text: "Anything blocking you this week?",
    situation: ["You're building the mobile login screen this week.", "You're waiting on the design team for the final error messages; everything else is on track."],
  },
  {
    id: "bl-access", type: "blocker", context: "1:1. Your skip-level manager asks:", text: "Is there anything slowing your team down that I could help with?",
    situation: ["You manage a team of 5 analysts.", "New hires wait about 2 weeks for database access, and 2 of them are stuck right now."],
  },
  {
    id: "bl-dependency", type: "blocker", context: "Project sync. The program manager asks:", text: "Are you waiting on anything from the platform team for the integration?",
    situation: ["You're building the integration with the platform team's new API.", "You still need their API keys for the test environment. You asked on Monday and haven't heard back."],
  },
  {
    id: "bl-data", type: "blocker", context: "Weekly sync. Your manager asks:", text: "The report was due Monday. What's holding it up?",
    situation: ["You own the weekly sales report.", "The finance numbers arrived on Tuesday instead of Friday, and you need 1 more day to check them."],
  },
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
 * The first questions a fresh guest gets, in this order (one of each type, then one more status): a fixed order
 * so the jury's run is predictable and its audio can be pre-generated (POST /api/speech/prewarm).
 */
export const JURY_ORDER: readonly string[] = ["st-onboarding", "de-scope", "es-feature", "bl-general", "st-bugfix"];

/**
 * The next question in JURY_ORDER this guest hasn't seen, while they have seen fewer than JURY_ORDER.length
 * questions; null afterwards (then the start route picks at random).
 */
export function juryQuestion(excludeIds: readonly string[]): ColdQuestion | null {
  if (excludeIds.length >= JURY_ORDER.length) return null;
  const seen = new Set(excludeIds);
  const id = JURY_ORDER.find((x) => !seen.has(x));
  return id ? getQuestion(id) : null;
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
