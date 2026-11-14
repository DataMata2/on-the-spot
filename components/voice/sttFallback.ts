// Which transcript a hybrid recording ends with. Pure, so it is unit-tested.
// The server (ElevenLabs) text wins when it has words; any server error, timeout or empty result falls back to
// the Web Speech text recorded in parallel; both empty means "we didn't hear anything". The fallback is silent.

export type ServerTranscript = { ok: true; text: string } | { ok: false };

export interface ChosenTranscript {
  text: string;
  source: "server" | "browser" | "none";
}

export function chooseTranscript(server: ServerTranscript | null, browserText: string): ChosenTranscript {
  const s = server?.ok ? server.text.trim() : "";
  if (s) return { text: s, source: "server" };
  const b = browserText.trim();
  if (b) return { text: b, source: "browser" };
  return { text: "", source: "none" };
}
