// Which transcript a hybrid recording ends with. Pure, so it is unit-tested.
// The server (ElevenLabs) text wins when it has words; any server error, timeout, empty or word-less result
// ("...", "-", "[inaudible]", "(music)") falls back to the Web Speech text recorded in parallel, when that has
// any text; both empty means "we didn't hear anything". The fallback is silent.

export type ServerTranscript = { ok: true; text: string } | { ok: false };

export interface ChosenTranscript {
  text: string;
  source: "server" | "browser" | "none";
}

/** Does the text contain a spoken word? Bracketed or parenthesized sound tags like "[inaudible]" don't count. */
export function hasWords(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " "));
}

export function chooseTranscript(server: ServerTranscript | null, browserText: string): ChosenTranscript {
  const s = server?.ok ? server.text.trim() : "";
  const b = browserText.trim();
  if (s && hasWords(s)) return { text: s, source: "server" };
  if (b) return { text: b, source: "browser" };
  // Neither has words: a word-less server result is still "we didn't hear anything", not a transcript.
  return { text: "", source: "none" };
}
