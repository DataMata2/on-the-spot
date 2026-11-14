// The Rehearse final screen: for each question, the user's best first sentence, taken from the answer and the
// feedback already on the client (no AI call). When the feedback has a stronger version, its first sentence is the
// one to repeat (labelled as such); otherwise the user's own opening. Pure; unit-tested in __tests__/summary.test.ts.

import { firstSentence } from "@/lib/drill1/checks";

export interface RehearseAnswer {
  questionId: string;
  questionText: string;
  /** The graded answer text. */
  graded: string;
  strongerVersion: string | null;
}

export interface BestOpening {
  text: string;
  /** True when it comes from the stronger version, not the user's own words. */
  stronger: boolean;
}

/** The opening of a text; "…" marks one cut at the word cap (an unpunctuated spoken answer). */
function opening(text: string | null): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const first = firstSentence(t).trim();
  return first && first.length < t.length && !/[.!?…]$/.test(first) ? `${first}…` : first;
}

/** The first sentence to repeat for one answer; null when there is nothing usable. */
export function bestOpening(a: Pick<RehearseAnswer, "graded" | "strongerVersion">): BestOpening | null {
  const stronger = opening(a.strongerVersion);
  if (stronger) return { text: stronger, stronger: true };
  const own = opening(a.graded);
  return own ? { text: own, stronger: false } : null;
}
