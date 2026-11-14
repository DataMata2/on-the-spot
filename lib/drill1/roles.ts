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

export type QuestionVariant = "cold" | "transfer";

export interface RoleQuestion extends ColdQuestion {
  variant: QuestionVariant;
}

const c = (id: string, type: QuestionType, context: string, text: string): RoleQuestion => ({ id, type, context, text, variant: "cold" });
const t = (id: string, type: QuestionType, context: string, text: string): RoleQuestion => ({ id, type, context, text, variant: "transfer" });

/**
 * Six per role: one cold question of each type, then two transfers (status and decision in a harder room). The
 * order is the order a fresh user meets them (deterministic, so the audio can be pre-generated).
 */
export const ROLE_BANKS: Record<BankRole, readonly RoleQuestion[]> = {
  "software-engineer": [
    c("se-st-deploy", "status", "Standup. Your tech lead asks:", "Is the payment fix deployed, or still in review?"),
    c("se-de-upgrade", "decision", "Architecture review. The staff engineer asks:", "Should we upgrade the framework now, or wait until after the release?"),
    c("se-es-search", "estimate", "Sprint planning. The PM asks:", "How long will the new search API take?"),
    c("se-bl-env", "blocker", "Standup. Your manager wraps up:", "Anything blocking you on the test environment?"),
    t("se-st-outage", "status", "Incident call. The VP of Engineering joins and asks:", "Where are we on the outage? When will users be back?"),
    t("se-de-rewrite", "decision", "Quarterly planning. The CTO asks you directly:", "Should we rewrite the billing module this quarter, yes or no?"),
  ],
  "product-manager": [
    c("pm-st-roadmap", "status", "Weekly sync. Your VP of Product asks:", "Where are we on the Q3 roadmap? Is anything slipping?"),
    c("pm-de-priority", "decision", "Sprint planning. The tech lead asks:", "Which goes first: the referral program or the new onboarding?"),
    c("pm-es-beta", "estimate", "Leadership review. The CEO asks:", "When can we open the beta to all customers?"),
    c("pm-bl-spec", "blocker", "1:1. Your manager asks:", "Is anything holding up the spec for the mobile app?"),
    t("pm-st-sales", "status", "Sales kickoff. The head of sales asks you:", "Can my team start selling the new plan next month?"),
    t("pm-de-kill", "decision", "Board prep. The COO asks:", "Usage is low. Do we keep the feature or kill it?"),
  ],
  designer: [
    c("ds-st-mocks", "status", "Standup. The PM asks:", "Are the checkout mockups ready for engineering?"),
    c("ds-de-option", "decision", "Design critique. The design lead asks:", "Option A or option B for the home screen? Which one would you ship?"),
    c("ds-es-dark", "estimate", "Planning meeting. Your manager asks:", "How long to update the design system for dark mode?"),
    c("ds-bl-tests", "blocker", "Weekly sync. The research lead asks:", "Is anything stopping you from running the usability tests?"),
    t("ds-st-client", "status", "Client call. The account manager turns to you:", "Can you tell the client where the new brand work is?"),
    t("ds-de-animation", "decision", "Sprint review. An engineer pushes back:", "This animation adds a week. Is it worth keeping?"),
  ],
  "data-analytics": [
    c("da-st-dashboard", "status", "Standup. Your manager asks:", "Is the revenue dashboard updated with last week's data?"),
    c("da-de-metric", "decision", "Metrics review. The head of growth asks:", "Should our main metric be weekly or monthly active users?"),
    c("da-es-churn", "estimate", "Planning meeting. The PM asks:", "How long until the churn model is ready to use?"),
    c("da-bl-access", "blocker", "Standup. Your team lead asks:", "Are you still waiting on access to the sales database?"),
    t("da-st-board", "status", "Exec review. The CFO turns to you:", "Can we trust these numbers for the board deck?"),
    t("da-de-abtest", "decision", "Product review. The VP of Product asks:", "The A/B test is close. Do we ship the new version or not?"),
  ],
  "marketing-sales": [
    c("ms-st-campaign", "status", "Weekly sync. The marketing director asks:", "How is the spring campaign doing so far?"),
    c("ms-de-budget", "decision", "Budget meeting. Your manager asks:", "Should we move more budget to LinkedIn, or keep it on search ads?"),
    c("ms-es-quarter", "estimate", "Pipeline review. The VP of Sales asks:", "How much do you expect to close this quarter?"),
    c("ms-bl-contract", "blocker", "Deal review. The sales manager asks:", "What's holding up the Acme contract?"),
    t("ms-st-pricing", "status", "Product sync. The PM asks you:", "What are customers saying about the new pricing?"),
    t("ms-de-discount", "decision", "Leadership meeting. The CEO asks you directly:", "Should we give this client the twenty percent discount?"),
  ],
  "finance-ops": [
    c("fo-st-close", "status", "Weekly sync. The controller asks:", "Are we on track to close the books by Friday?"),
    c("fo-de-vendor", "decision", "Ops meeting. Your manager asks:", "Should we renew with our logistics vendor, or switch?"),
    c("fo-es-travel", "estimate", "Budget review. The CFO asks:", "Roughly how much will we spend on travel this quarter?"),
    c("fo-bl-invoices", "blocker", "Standup. Your team lead asks:", "Is anything slowing down the invoice backlog?"),
    t("fo-st-runway", "status", "Leadership meeting. The CEO turns to you:", "Where are we on cash? How much runway do we have?"),
    t("fo-de-hires", "decision", "Planning meeting. The head of engineering asks:", "Can we afford two more hires this year, yes or no?"),
  ],
  healthcare: [
    c("hc-st-patient", "status", "Morning huddle. The charge nurse asks:", "How is the patient in room twelve doing this morning?"),
    c("hc-de-discharge", "decision", "Rounds. The attending physician asks:", "Is the patient in bed four ready to go home today, or should we keep her?"),
    c("hc-es-wait", "estimate", "Clinic meeting. The practice manager asks:", "How long are patients waiting for a follow-up right now?"),
    c("hc-bl-shift", "blocker", "Shift handover. Your manager asks:", "Is anything getting in the way of your shift tonight?"),
    t("hc-st-family", "status", "Family meeting. The patient's daughter asks you:", "Is my mother getting better? What happens next?"),
    t("hc-de-monitors", "decision", "Budget meeting. The hospital administrator asks:", "Should we buy the new monitors this year, or wait?"),
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
 * on the same type): an unseen one of that type, at random.
 */
export function pickFromPool<Q extends ColdQuestion>(pool: readonly Q[], type: QuestionType | null, excludeIds: readonly string[], rand: () => number = Math.random): Q | null {
  const seen = new Set(excludeIds);
  const fresh = pool.filter((q) => !seen.has(q.id) && (!type || q.type === type));
  if (fresh.length === 0) return null;
  return type ? fresh[Math.min(fresh.length - 1, Math.floor(rand() * fresh.length))] : fresh[0];
}

/**
 * The question POST /api/drill1/start serves for a bank role or "general" (generated "other" questions come in as
 * `pool`). A role's questions come first; when its bank (or the retry's type in it) is used up, the general bank
 * takes over: the jury order for a fresh no-type start, else pickQuestion.
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
