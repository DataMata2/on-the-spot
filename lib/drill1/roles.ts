// Drill 1 roles: "What do you do?" before the first cold question, so the question matches the user's job.
// Pure data + validation + pickers; safe on client and server. The role is stored in the browser (lib/progress/role)
// and sent with POST /api/drill1/start (`role`, plus `roleText` for "other"); the server validates it here.
//
// Each role bank holds cold variants (the everyday room: standup, sprint planning, a 1:1) and transfer variants
// (the same skill moved to a harder room: an exec, a client, another team). "general" is the original bank
// (lib/drill1/questions.ts), used for "Skip" and as the fallback. "other" = free text; the server writes the
// questions from it (lib/drill1/role-ai.ts) and falls back to general on any failure.

import { getQuestion, type ColdQuestion, type QuestionType } from "./questions";

export const BANK_ROLES = [
  "software-engineer",
  "product-manager",
  "designer",
  "data-analytics",
  "marketing-sales",
  "finance-ops",
  "healthcare",
] as const;
export type BankRole = (typeof BANK_ROLES)[number];
/** What the user picked: a bank role, "other" (free text) or "general" (skipped). */
export type RoleId = BankRole | "other" | "general";
export const ROLE_IDS: readonly RoleId[] = [...BANK_ROLES, "other", "general"];

/** The tap chips, in screen order ("general" is the skip link, not a chip). */
export const ROLE_CHIPS: readonly { id: Exclude<RoleId, "general">; label: string }[] = [
  { id: "software-engineer", label: "Software engineer" },
  { id: "product-manager", label: "Product manager" },
  { id: "designer", label: "Designer" },
  { id: "data-analytics", label: "Data/analytics" },
  { id: "marketing-sales", label: "Marketing/sales" },
  { id: "finance-ops", label: "Finance/ops" },
  { id: "healthcare", label: "Healthcare" },
  { id: "other", label: "Other" },
];

/** The "Other" free text: at most this many characters (client maxLength and server check). */
export const ROLE_TEXT_MAX = 60;

export function isRoleId(v: unknown): v is RoleId {
  return typeof v === "string" && (ROLE_IDS as readonly string[]).includes(v);
}

export function isBankRole(v: unknown): v is BankRole {
  return typeof v === "string" && (BANK_ROLES as readonly string[]).includes(v);
}

/**
 * The "Other" free text, cleaned: control characters and angle brackets dropped (it is put in a prompt between
 * tags), whitespace collapsed. null when empty or longer than ROLE_TEXT_MAX (rejected, not cut).
 */
export function cleanRoleText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const text = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text.length > ROLE_TEXT_MAX) return null;
  return text;
}

export interface Role {
  id: RoleId;
  /** Only for "other". */
  text?: string;
}

/** A role from untrusted input (request body or storage); null when invalid. "other" needs a valid text. */
export function parseRole(id: unknown, text?: unknown): Role | null {
  if (!isRoleId(id)) return null;
  if (id !== "other") return { id };
  const t = cleanRoleText(text);
  return t ? { id, text: t } : null;
}

/** "Software engineer", the "Other" text, or "General questions". */
export function roleLabel(role: Role): string {
  if (role.id === "general") return "General questions";
  if (role.id === "other") return role.text ?? "Other";
  return ROLE_CHIPS.find((c) => c.id === role.id)?.label ?? "General questions";
}

/** Words that mark "Other" text as an instruction to the model, not a job (whole words, any case). */
const NOT_A_JOB = /\b(system|prompts?|ignore|instructions?|jailbreak)\b/i;

/**
 * The "Other" text as a job title fit to show on screen, or null when it doesn't look like one: only letters, digits,
 * spaces and - / & , . ' ( ); at most ROLE_TEXT_MAX chars; starts with a letter; a "/" only between two word
 * characters (so "Data/analytics" passes, a "/command" or a tag remnant like "b x /b" does not); none of the
 * NOT_A_JOB words. Display only: the server's own checks (cleanRoleText) are unchanged.
 */
export function displayJobTitle(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > ROLE_TEXT_MAX) return null;
  if (!/^\p{L}[\p{L}\p{M}\p{N} \-/&,.'()\u2019]*$/u.test(t)) return null;
  if (/(^|[^\p{L}\p{N}])\/|\/($|[^\p{L}\p{N}])/u.test(t)) return null;
  if (NOT_A_JOB.test(t)) return null;
  return t;
}

/** roleLabel for the screen: the "Other" text only when it looks like a clean job title (displayJobTitle), else "Other". */
export function roleDisplayLabel(role: Role): string {
  if (role.id === "other") return displayJobTitle(role.text) ?? "Other";
  return roleLabel(role);
}

export type QuestionVariant = "cold" | "transfer";

export interface RoleQuestion extends ColdQuestion {
  variant: QuestionVariant;
}

type Situation = readonly [you: string, facts: string];
const c = (id: string, type: QuestionType, context: string, text: string, situation: Situation): RoleQuestion => ({ id, type, context, text, situation, variant: "cold" });
const t = (id: string, type: QuestionType, context: string, text: string, situation: Situation): RoleQuestion => ({ id, type, context, text, situation, variant: "transfer" });

/**
 * Six per role: one cold question of each type, then two transfers (status and decision in a harder room). The
 * order is the order a fresh user meets them (deterministic, so the audio can be pre-generated).
 */
export const ROLE_BANKS: Record<BankRole, readonly RoleQuestion[]> = {
  "software-engineer": [
    c("se-st-deploy", "status", "Standup. Your tech lead asks:", "Is the payment fix deployed, or still in review?", ["You fixed the payment timeout bug.", "The fix passed tests and has 1 approval; it needs a second review before it can deploy."]),
    c("se-de-upgrade", "decision", "Architecture review. The staff engineer asks:", "Should we upgrade the framework now, or wait until after the release?", ["You looked into the framework upgrade.", "It touches about 40 files and has 2 breaking changes. The release is 3 weeks away."]),
    c("se-es-search", "estimate", "Sprint planning. The PM asks:", "How long will the new search API take?", ["You're the engineer on the new search API.", "The database index is ready; the endpoint and tests are left. A similar API took you about 2 weeks."]),
    c("se-bl-env", "blocker", "Standup. Your manager wraps up:", "Anything blocking you on the test environment?", ["You need the test environment to finish the checkout tests.", "It has been down since yesterday. The DevOps team says they're on it but gave no time."]),
    t("se-st-outage", "status", "Incident call. The VP of Engineering joins and asks:", "Where are we on the outage? When will users be back?", ["You're the on-call engineer.", "Logins fail for about 30% of users after this morning's deploy. You're rolling it back, which takes about 20 minutes."]),
    t("se-de-rewrite", "decision", "Quarterly planning. The CTO asks you directly:", "Should we rewrite the billing module this quarter, yes or no?", ["You've worked in the billing module for a year.", "It causes about 3 bugs a month, but a rewrite would take your team most of the quarter."]),
  ],
  "product-manager": [
    c("pm-st-roadmap", "status", "Weekly sync. Your VP of Product asks:", "Where are we on the Q3 roadmap? Is anything slipping?", ["You're the PM for the Q3 roadmap.", "4 of 6 items are on track. The reporting feature is 2 weeks late because a key engineer was out sick."]),
    c("pm-de-priority", "decision", "Sprint planning. The tech lead asks:", "Which goes first: the referral program or the new onboarding?", ["You own both the referral program and the new onboarding.", "Onboarding fixes the step where 40% of new users drop off; referrals are a growth bet with no data yet."]),
    c("pm-es-beta", "estimate", "Leadership review. The CEO asks:", "When can we open the beta to all customers?", ["You run the beta with 20 customers.", "Feedback is good, but 2 bugs block a wider launch. Engineering says the fixes need about 2 weeks."]),
    c("pm-bl-spec", "blocker", "1:1. Your manager asks:", "Is anything holding up the spec for the mobile app?", ["You're writing the spec for the mobile app.", "It's mostly done. You're waiting on legal to approve the data privacy section."]),
    t("pm-st-sales", "status", "Sales kickoff. The head of sales asks you:", "Can my team start selling the new plan next month?", ["You're launching the new pricing plan.", "Billing support is done; the sales materials are still in review. The launch date is the 1st of next month."]),
    t("pm-de-kill", "decision", "Board prep. The COO asks:", "Usage is low. Do we keep the feature or kill it?", ["You own a feature that few people use.", "Only 3% of customers use it, but 2 of your biggest customers use it every day."]),
  ],
  designer: [
    c("ds-st-mocks", "status", "Standup. The PM asks:", "Are the checkout mockups ready for engineering?", ["You're designing the new checkout flow.", "The desktop mockups are done; mobile needs about 2 more days."]),
    c("ds-de-option", "decision", "Design critique. The design lead asks:", "Option A or option B for the home screen? Which one would you ship?", ["You designed both home screen options.", "In tests, A was faster to use. Users liked how B looked, but 3 of 8 people missed its search bar."]),
    c("ds-es-dark", "estimate", "Planning meeting. Your manager asks:", "How long to update the design system for dark mode?", ["You maintain the design system.", "It has about 120 components. The colour tokens are ready, but every component still needs checking."]),
    c("ds-bl-tests", "blocker", "Weekly sync. The research lead asks:", "Is anything stopping you from running the usability tests?", ["You planned usability tests for the new settings page.", "The prototype is ready, but you still need 5 participants, and recruiting is slow."]),
    t("ds-st-client", "status", "Client call. The account manager turns to you:", "Can you tell the client where the new brand work is?", ["You lead the brand work for this client.", "The logo is approved. The colours and fonts are in a second round of changes, due next Friday."]),
    t("ds-de-animation", "decision", "Sprint review. An engineer pushes back:", "This animation adds a week. Is it worth keeping?", ["You designed the onboarding animation.", "In tests it helped new users understand the app, but engineering says it adds a week."]),
  ],
  "data-analytics": [
    c("da-st-dashboard", "status", "Standup. Your manager asks:", "Is the revenue dashboard updated with last week's data?", ["You own the revenue dashboard.", "Last week's data is in except one region, whose data feed broke on Sunday. The data engineers are fixing it."]),
    c("da-de-metric", "decision", "Metrics review. The head of growth asks:", "Should our main metric be weekly or monthly active users?", ["You analysed both metrics.", "Most users come back once or twice a week, so weekly users shows changes faster; monthly hides drops for weeks."]),
    c("da-es-churn", "estimate", "Planning meeting. The PM asks:", "How long until the churn model is ready to use?", ["You're building the churn model.", "The first version is right about 70% of the time. You need about 2 more weeks to test it on new data."]),
    c("da-bl-access", "blocker", "Standup. Your team lead asks:", "Are you still waiting on access to the sales database?", ["You need the sales database for a new report.", "You asked IT for access last week. They need your manager's approval, and the request is with him now."]),
    t("da-st-board", "status", "Exec review. The CFO turns to you:", "Can we trust these numbers for the board deck?", ["You checked the numbers for the board deck.", "Revenue and user numbers match finance. Churn is off by 2% because its definition changed last quarter."]),
    t("da-de-abtest", "decision", "Product review. The VP of Product asks:", "The A/B test is close. Do we ship the new version or not?", ["You ran the A/B test on the new checkout.", "The new version is up 1.5% in sales, but the result isn't significant yet; 1 more week would make it clear."]),
  ],
  "marketing-sales": [
    c("ms-st-campaign", "status", "Weekly sync. The marketing director asks:", "How is the spring campaign doing so far?", ["You run the spring campaign.", "After 2 weeks, sign-ups are 15% above target, but each sign-up costs more than planned."]),
    c("ms-de-budget", "decision", "Budget meeting. Your manager asks:", "Should we move more budget to LinkedIn, or keep it on search ads?", ["You manage the ad budget.", "LinkedIn brings fewer leads, but they buy twice as often. Search ads bring more leads at a lower cost."]),
    c("ms-es-quarter", "estimate", "Pipeline review. The VP of Sales asks:", "How much do you expect to close this quarter?", ["You're a sales rep with 8 open deals this quarter.", "3 deals are almost signed, worth about $120,000 together; the other 5 are early and hard to predict."]),
    c("ms-bl-contract", "blocker", "Deal review. The sales manager asks:", "What's holding up the Acme contract?", ["You're closing the Acme deal.", "Acme agreed on price, but their legal team wants changes to the data clause, and our legal team hasn't replied yet."]),
    t("ms-st-pricing", "status", "Product sync. The PM asks you:", "What are customers saying about the new pricing?", ["You've talked to about 20 customers since the new pricing launched.", "Most like the simpler plans, but 4 bigger customers complained that their price went up."]),
    t("ms-de-discount", "decision", "Leadership meeting. The CEO asks you directly:", "Should we give this client the twenty percent discount?", ["You manage this client's account.", "They'll sign for 2 years with the discount and may pick a competitor without it. Your usual limit is 10%."]),
  ],
  "finance-ops": [
    c("fo-st-close", "status", "Weekly sync. The controller asks:", "Are we on track to close the books by Friday?", ["You run the month-end close.", "Most accounts are done. 2 vendor invoices are missing, and you've asked the vendors for them."]),
    c("fo-de-vendor", "decision", "Ops meeting. Your manager asks:", "Should we renew with our logistics vendor, or switch?", ["You compared the logistics vendor with two others.", "The current one is reliable but 12% more expensive. The cheapest option has had late deliveries."]),
    c("fo-es-travel", "estimate", "Budget review. The CFO asks:", "Roughly how much will we spend on travel this quarter?", ["You track the company's travel spending.", "Last quarter it was about $40,000. This quarter has 2 big conferences, so it will be higher."]),
    c("fo-bl-invoices", "blocker", "Standup. Your team lead asks:", "Is anything slowing down the invoice backlog?", ["You manage the invoice backlog.", "About 200 invoices are waiting; half are stuck because the approval tool still sends them to people who left."]),
    t("fo-st-runway", "status", "Leadership meeting. The CEO turns to you:", "Where are we on cash? How much runway do we have?", ["You manage cash planning.", "There is about $3 million in the bank, and the company spends about $250,000 a month."]),
    t("fo-de-hires", "decision", "Planning meeting. The head of engineering asks:", "Can we afford two more hires this year, yes or no?", ["You own the hiring budget.", "This year's budget has room for 1 more hire. 2 hires work only if the new contract signs next month."]),
  ],
  healthcare: [
    c("hc-st-patient", "status", "Morning huddle. The charge nurse asks:", "How is the patient in room twelve doing this morning?", ["You're the nurse caring for the patient in room twelve.", "His fever dropped overnight and he ate breakfast, but his blood pressure is still a bit high."]),
    c("hc-de-discharge", "decision", "Rounds. The attending physician asks:", "Is the patient in bed four ready to go home today, or should we keep her?", ["You've cared for the patient in bed four for 2 days.", "Her pain is under control and she can walk, but her lab results come back this afternoon."]),
    c("hc-es-wait", "estimate", "Clinic meeting. The practice manager asks:", "How long are patients waiting for a follow-up right now?", ["You schedule follow-up visits for the clinic.", "Patients wait about 3 weeks right now, and one doctor is on leave until next month."]),
    c("hc-bl-shift", "blocker", "Shift handover. Your manager asks:", "Is anything getting in the way of your shift tonight?", ["You're a nurse on tonight's shift.", "The shift is one nurse short, and 2 of your patients need checks every hour."]),
    t("hc-st-family", "status", "Family meeting. The patient's daughter asks you:", "Is my mother getting better? What happens next?", ["You're the nurse caring for her mother.", "Her breathing is better since the new medicine. The doctor reviews her this afternoon to decide about going home."]),
    t("hc-de-monitors", "decision", "Budget meeting. The hospital administrator asks:", "Should we buy the new monitors this year, or wait?", ["You lead the nursing team on your ward.", "The old monitors fail about once a week. The new ones fit this year's budget only if training is cut."]),
  ],
};

/** Every role-bank question, role by role. */
export const ROLE_QUESTIONS: readonly RoleQuestion[] = BANK_ROLES.flatMap((r) => ROLE_BANKS[r]);

const ROLE_BY_ID = new Map(ROLE_QUESTIONS.map((q) => [q.id, q]));

/** A question from the general bank or any role bank, by id; null when unknown. */
export function getAnyQuestion(id: unknown): ColdQuestion | null {
  if (typeof id !== "string") return null;
  return getQuestion(id) ?? ROLE_BY_ID.get(id) ?? null;
}

/**
 * The next question from `pool` (a role bank or a generated set) for this start, or null when the pool has nothing
 * new (the caller then uses the general bank). No `type`: the first unseen one in pool order. With `type` (a retry
 * on the same type): an unseen one of that type, at random; when the pool has none of that type left, an unseen one
 * of another type, at random (the user stays in their role; the served question carries its own type).
 */
export function pickFromPool<Q extends ColdQuestion>(pool: readonly Q[], type: QuestionType | null, excludeIds: readonly string[], rand: () => number = Math.random): Q | null {
  const seen = new Set(excludeIds);
  const fresh = pool.filter((q) => !seen.has(q.id));
  if (fresh.length === 0) return null;
  if (!type) return fresh[0];
  const sameType = fresh.filter((q) => q.type === type);
  const from = sameType.length > 0 ? sameType : fresh;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}

/**
 * The question POST /api/drill1/start serves for a bank role or "general" (generated "other" questions come in as
 * `pool`). A role's questions come first: a retry takes the same type from the role when it can, else another type
 * from the role. Only when the whole role pool is used up does the general bank take over: the jury order for a
 * fresh no-type start, else pickQuestion.
 */
export function pickForRole(
  role: RoleId,
  type: QuestionType | null,
  excludeIds: readonly string[],
  opts: { pool?: readonly ColdQuestion[]; general: (type: QuestionType | null, excludeIds: readonly string[]) => ColdQuestion; rand?: () => number },
): ColdQuestion {
  const pool = opts.pool ?? (isBankRole(role) ? ROLE_BANKS[role] : null);
  if (pool) {
    const q = pickFromPool(pool, type, excludeIds, opts.rand);
    if (q) return q;
  }
  return opts.general(type, excludeIds);
}

/**
 * Where a started question came from (POST /api/drill1/start `source`, OTS-CURRENT-05): "generated" (written by the
 * AI for an "Other" role), "role" (a role bank), "general" (the general bank, as asked or because the role's pool
 * ran out), or "general_fallback" (an "Other" role whose questions couldn't be written: the UI says so, never
 * presenting it as tailored).
 */
export type StartSource = "generated" | "role" | "general" | "general_fallback";

export function startSource(role: RoleId, question: ColdQuestion, pool: readonly ColdQuestion[] | null | undefined): StartSource {
  if (role === "other") {
    if (!pool) return "general_fallback";
    return pool.includes(question) ? "generated" : "general";
  }
  if (isBankRole(role)) return ROLE_BANKS[role].some((q) => q.id === question.id) ? "role" : "general";
  return "general";
}
