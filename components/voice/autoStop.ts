// What to do when a recording ends without the user tapping stop (the max-duration timer, the engine giving
// up after a restart storm, or a recognition error). Pure, so it is unit-tested.

/** Why a recording ended. "user" = the user tapped stop (or switched mode); everything else ended on its own. */
export type EndReason = "user" | "max" | "auto" | "error";

export interface RecordingEnd {
  /** Which start() this ending belongs to (increments on every start). */
  session: number;
  reason: EndReason;
  /** The full transcript at the end (pending interim text included). */
  text: string;
}

export type AutoStopAction = "capture" | "heard_nothing" | "ignore";

/**
 * capture: hand the text to onCaptured (once). heard_nothing: show the "we didn't hear anything" state.
 * ignore: the user stopped it (handleStop deals with it), it predates this capture box, or it is handled.
 */
export function autoStopAction(end: RecordingEnd | null, opts: { mountedAfter: number; handled: number | null }): AutoStopAction {
  if (!end || end.reason === "user") return "ignore";
  if (end.session <= opts.mountedAfter || end.session === opts.handled) return "ignore";
  return end.text.trim() ? "capture" : "heard_nothing";
}

/** The visible notice for an automatic stop, or null. */
export function autoStopNotice(end: RecordingEnd | null, maxMs: number): string | null {
  if (end?.reason !== "max") return null;
  return `Time's up: we stopped at ${Math.round(maxMs / 1000)} seconds.`;
}

/** How long the time's-up notice stays on screen before the answer moves on to review. */
export const TIME_UP_NOTICE_MS = 1500;
