// What POST /api/speech/prewarm pre-generates: only what the jury reaches first, to stay inside the free plan.
// Drill 1: the fixed first questions of a fresh guest (JURY_ORDER). Drill 2: the first scenario a fresh guest gets,
// its opening line, every reveal line (said verbatim when the character model is skipped), the change lines, and
// the "sounds like you've got it" reply.
import { JURY_ORDER, getQuestion } from "@/lib/drill1/questions";
import { changeBeforeConfirm, createState, SUGGEST_CONFIRM_REPLY } from "@/lib/drill2/engine";
import { pickScenario } from "@/lib/drill2/scenarios";
import { normalizeTtsText } from "./tts-allow";

/** The prewarm refuses to run when its texts add up to more than this many characters. */
export const PREWARM_MAX_CHARS = 3000;

export function prewarmTexts(): string[] {
  const texts: string[] = [];
  for (const id of JURY_ORDER) {
    const q = getQuestion(id);
    if (q) texts.push(q.text);
  }
  const s = pickScenario([]);
  texts.push(s.managerLine);
  for (const f of s.hiddenFacts) texts.push(f.revealLine);
  if (s.change) {
    texts.push(s.change.announceLine, s.change.revealLine);
    const pending = changeBeforeConfirm(s, createState(s));
    if (pending) texts.push(pending.reply);
  }
  texts.push(SUGGEST_CONFIRM_REPLY);
  return [...new Set(texts.map(normalizeTtsText).filter(Boolean))];
}
