// What POST /api/speech/prewarm pre-generates: every static text a guest or Pro user can hear, as the exact
// string the TTS route will be asked to speak (the cache key is the normalized text). Jury-first order: the drill 1
// questions of a fresh guest (JURY_ORDER) and the drill 2 scenario a fresh guest gets, then the rest of the drill 1
// bank, then the other drill 2 scenarios.
// Drill 2 replies the character model phrases can't be known ahead; what is listed is every reply the routes build
// without it: the verbatim fact lines (the character model's fallback, and what is said when the AI budget is out),
// the off-topic replies, the "sounds like you've got it" reply, a condition change appended to the turn it fires on,
// and the confirm route's "the plan changed, say it back again" reply.
// The texts come in two sets, each under the same PREWARM_MAX_CHARS refusal limit: "core" (everything above, as
// before) and "roles" (the drill 1 role banks: each role's first question, then the rest, role by role). The route
// takes `?set=roles`; scripts/prewarm-tts.sh runs both.
import { JURY_ORDER, QUESTIONS, getQuestion } from "@/lib/drill1/questions";
import { BANK_ROLES, ROLE_BANKS } from "@/lib/drill1/roles";
import { changeBeforeConfirm, createState, offTopicReply, revealFor, SUGGEST_CONFIRM_REPLY } from "@/lib/drill2/engine";
import { pickScenario, SCENARIOS } from "@/lib/drill2/scenarios";
import type { DrillState, ExtractedTurn, Scenario } from "@/lib/drill2/types";
import { normalizeTtsText } from "./tts-allow";

/** The prewarm refuses to run when its texts add up to more than this many characters (~2,000 credits). */
export const PREWARM_MAX_CHARS = 4000;

/**
 * The reply POST /api/drill2/turn builds for `turn` from `state` when the character model is not used (keep in
 * step with turnHandler in lib/drill2/http.ts): the suggest-confirm reply, the fact lines joined, or the off-topic
 * reply; then the condition change, said verbatim, when it fires on this turn.
 */
export function verbatimTurnReply(s: Scenario, state: DrillState, turn: ExtractedTurn): string {
  const r = revealFor(s, state, turn);
  const factLines = r.allowedLines.filter((l) => l !== r.changeLine);
  let reply = turn.intent === "confirmation" ? SUGGEST_CONFIRM_REPLY : factLines.length ? factLines.join(" ") : offTopicReply(r.state.turns);
  if (r.changeLine) reply = `${reply} ${r.changeLine}`;
  return reply;
}

/** Every static line one drill 2 scenario can speak, in the order a run meets them. */
export function scenarioTexts(s: Scenario): string[] {
  const texts = [s.managerLine];
  const turns: ExtractedTurn[] = [
    ...s.topics.map((t) => ({ intent: "question" as const, topics: [t.key] })),
    { intent: "question", topics: [] },
    { intent: "confirmation", topics: [] },
  ];
  // Enough prior-turn counts to meet every off-topic variant and both sides of the condition change.
  const fireOn = s.change?.fireOnTurn ?? 0;
  for (let done = 0; done < fireOn + 3; done++) {
    const state: DrillState = { ...createState(s), turns: done, changeFired: Boolean(s.change) && done >= fireOn };
    for (const turn of turns) texts.push(verbatimTurnReply(s, state, turn));
  }
  const pending = changeBeforeConfirm(s, createState(s));
  if (pending) texts.push(pending.reply);
  return texts;
}

export type PrewarmSet = "core" | "roles";
export const PREWARM_SETS: readonly PrewarmSet[] = ["core", "roles"];

export function isPrewarmSet(v: unknown): v is PrewarmSet {
  return typeof v === "string" && (PREWARM_SETS as readonly string[]).includes(v);
}

/** The drill 1 role banks: the first question of every role (what a fresh user hears first), then the rest. */
export function roleTexts(): string[] {
  const texts = BANK_ROLES.map((r) => ROLE_BANKS[r][0].text);
  for (const r of BANK_ROLES) texts.push(...ROLE_BANKS[r].map((q) => q.text));
  return [...new Set(texts.map(normalizeTtsText).filter(Boolean))];
}

export function prewarmTexts(set: PrewarmSet = "core"): string[] {
  if (set === "roles") return roleTexts();
  const first = pickScenario([]);
  const texts: string[] = [];
  for (const id of JURY_ORDER) {
    const q = getQuestion(id);
    if (q) texts.push(q.text);
  }
  texts.push(...scenarioTexts(first));
  texts.push(...QUESTIONS.map((q) => q.text));
  for (const s of SCENARIOS) if (s.id !== first.id) texts.push(...scenarioTexts(s));
  return [...new Set(texts.map(normalizeTtsText).filter(Boolean))];
}
