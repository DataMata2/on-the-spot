// Drill 1 deterministic checks on a transcript. Pure functions, no I/O; unit-tested in __tests__/checks.test.ts.
// Browser speech-to-text often returns text with no punctuation, so sentence logic has a fallback:
// unpunctuated speech is cut into chunks of ~CHUNK_WORDS words and the result is marked `punctuated: false`.

/** Words per estimated sentence when the transcript has no sentence punctuation. */
export const CHUNK_WORDS = 15;
/** The "first sentence" is capped at this many words (a run-on opening still has to answer early). */
export const FIRST_SENTENCE_MAX_WORDS = 20;
/** Fewer words than this is not an answer we can grade. */
export const MIN_WORDS = 3;
/** Longest transcript the feedback route accepts (characters). */
export const MAX_TRANSCRIPT_CHARS = 1_500;

const WORD_RE = /\$?\d+(?:[.,]\d+)*%?|[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g;

/** Words in the text (letters/digits runs, contractions kept whole). */
export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function wordCount(text: string): number {
  return words(text).length;
}

/**
 * Does the text have a sentence break inside it (. ! ? followed by more text)? A lone final period does not
 * count: a long run-on with one period at the end is still treated as unpunctuated speech.
 */
export function isPunctuated(text: string): boolean {
  return /[.!?]["')\]]?\s+\S/.test(text.replace(/(\d)\.(\d)/g, "$1$2"));
}

/**
 * Split into sentences on . ! ? (keeping decimals and common abbreviations whole). Unpunctuated text is cut
 * into chunks of CHUNK_WORDS words. Empty input → [].
 */
export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  if (!isPunctuated(t)) {
    const w = t.split(" ");
    const out: string[] = [];
    for (let i = 0; i < w.length; i += CHUNK_WORDS) out.push(w.slice(i, i + CHUNK_WORDS).join(" "));
    return out;
  }
  const protectedText = t
    .replace(/\b(Mr|Mrs|Ms|Dr|vs|etc|e\.g|i\.e|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi, (m) => m.replace(/\./g, "\u0000"))
    .replace(/(\d)\.(\d)/g, "$1\u0000$2");
  return protectedText
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter((s) => wordCount(s) > 0);
}

export function sentenceCount(text: string): number {
  return splitSentences(text).length;
}

/** The opening the answer-first check looks at: the first sentence, capped at FIRST_SENTENCE_MAX_WORDS words. */
export function firstSentence(text: string): string {
  const first = splitSentences(text)[0] ?? "";
  const w = first.split(" ");
  return w.length > FIRST_SENTENCE_MAX_WORDS ? w.slice(0, FIRST_SENTENCE_MAX_WORDS).join(" ") : first;
}

/**
 * Words and phrases that show a status, decision, estimate or blocker answer. Matched whole-word,
 * case-insensitive. Longer phrases first so the reported match is the most specific one.
 */
export const ANSWER_WORDS: readonly string[] = [
  "i think we should", "i recommend", "i'd recommend", "i would recommend", "i'd go with", "i would go with",
  "we should", "let's go with", "my recommendation", "i suggest", "i'd suggest",
  "on track", "off track", "at risk", "ahead of schedule", "behind schedule", "no blockers", "not blocked",
  "nothing blocking", "waiting on", "waiting for", "blocked on", "blocked by",
  "by end of day", "by the end of", "end of the week", "end of the month", "next week", "this week",
  "by monday", "by tuesday", "by wednesday", "by thursday", "by friday", "by tomorrow", "by today",
  "not yet", "not ready", "almost done", "went out", "is live", "it's live",
  "done", "finished", "completed", "shipped", "deployed", "merged", "released", "ready", "blocked",
  "behind", "delayed", "yes", "yeah", "yep", "no", "nope", "nothing", "will", "won't", "can't", "can",
  "today", "tomorrow", "definitely", "absolutely",
];

const UNIT_RE = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a few)\s+(?:hours?|days?|weeks?|months?|sprints?|quarters?)\b/i;
const MONEY_RE = /\$\s?\d|\b\d+(?:\.\d+)?\s?(?:k|thousand|dollars|percent|%)/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");
const ANSWER_RES = ANSWER_WORDS.map((w) => ({ word: w, re: new RegExp(`(?<![A-Za-z'’])${escapeRe(w)}(?![A-Za-z'’])`, "i") }));

/** The first answer word/phrase found in the opening sentence (or an amount/duration), or null. */
export function findAnswerWord(text: string): string | null {
  const opening = firstSentence(text);
  if (!opening) return null;
  // The earliest match in the opening wins; on a tie, the longer (more specific) phrase.
  let best: { word: string; at: number; len: number } | null = null;
  const consider = (word: string, at: number, len: number) => {
    if (!best || at < best.at || (at === best.at && len > best.len)) best = { word, at, len };
  };
  for (const { word, re } of ANSWER_RES) {
    const m = re.exec(opening);
    if (m) consider(word, m.index, m[0].length);
  }
  for (const re of [UNIT_RE, MONEY_RE]) {
    const m = re.exec(opening);
    if (m) consider(m[0], m.index, m[0].length);
  }
  return best ? (best as { word: string }).word : null;
}

export const FILLERS: readonly string[] = ["um", "uh", "like", "you know", "basically"];

const FILLER_RES: Record<string, RegExp> = {
  um: /\b(?:um+|umm+|erm+|hmm+)\b/gi,
  uh: /\b(?:uh+|er|ah)\b/gi,
  // "like" as a filler: not "would like", "I'd like", "looks like", "feel like", "seems like", "something like".
  like: /(?<!\b(?:would|i'd|we'd|you'd|looks|look|looked|feel|feels|felt|seems|seem|something|more|just|i|we|they|you|don't|didn't)\s)\blike\b/gi,
  "you know": /\byou know\b(?!\s+(?:what|how|why|when|where|who|if|that|the|about))/gi,
  basically: /\bbasically\b/gi,
};

/** Filler counts by filler, and the total. */
export function fillerCounts(text: string): { total: number; byFiller: Record<string, number> } {
  const byFiller: Record<string, number> = {};
  let total = 0;
  for (const f of FILLERS) {
    const n = (text.match(FILLER_RES[f]) ?? []).length;
    if (n > 0) byFiller[f] = n;
    total += n;
  }
  return { total, byFiller };
}

export interface DeterministicChecks {
  words: number;
  sentences: number;
  /** False when the transcript had no punctuation and sentences were estimated. */
  punctuated: boolean;
  firstSentence: string;
  /** The status/decision word found in the opening, or null. */
  answerWord: string | null;
  fillers: { total: number; byFiller: Record<string, number> };
}

export function runChecks(text: string): DeterministicChecks {
  const t = text.replace(/\s+/g, " ").trim();
  return {
    words: wordCount(t),
    sentences: sentenceCount(t),
    punctuated: isPunctuated(t) || (/[.!?]$/.test(t) && wordCount(t) <= CHUNK_WORDS),
    firstSentence: firstSentence(t),
    answerWord: findAnswerWord(t),
    fillers: fillerCounts(t),
  };
}
