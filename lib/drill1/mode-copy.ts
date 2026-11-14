// Copy that depends on HOW an answer was given: a spoken answer was "said out loud", a typed one was "written".
// Feedback and end-of-run screens take the answer's actual mode from here, so a typed answer never reads as spoken.
// Pure; unit-tested in __tests__/mode-copy.test.ts.

export type InputMode = "voice" | "typed";

export interface ModeCopy {
  /** Heading over the graded answer. */
  yourAnswer: string;
  /** Under the stronger version: what the brackets mean. */
  bracketsNote: string;
  /** The reassurance line at the bottom of the feedback card. */
  gradeNote: string;
  /** The checklist hint when the point is missing. */
  missingPoint: string;
}

export const MODE_COPY: Record<InputMode, ModeCopy> = {
  voice: {
    yourAnswer: "What you said",
    bracketsNote: "Brackets like [your ETA] mark facts you didn't say. We never make them up.",
    gradeNote: "We grade what you said, never your accent.",
    missingPoint: "Missing: say the answer itself.",
  },
  typed: {
    yourAnswer: "What you wrote",
    bracketsNote: "Brackets like [your ETA] mark facts you didn't give. We never make them up.",
    gradeNote: "We grade what you answered, not your spelling or grammar.",
    missingPoint: "Missing: give the answer itself.",
  },
};

/** The copy for one answer's mode (an unknown mode reads neutral, as typed). */
export function modeCopy(mode: InputMode | null | undefined): ModeCopy {
  return MODE_COPY[mode === "voice" ? "voice" : "typed"];
}

/**
 * "You answered 4 of 5 questions out loud." only when every answer was spoken; any typed answer makes it neutral
 * ("You answered 4 of 5 questions.").
 */
export function answeredLine(done: number, total: number, modes: readonly InputMode[]): string {
  const spoken = modes.length > 0 && modes.every((m) => m === "voice");
  return `You answered ${done} of ${total} question${total === 1 ? "" : "s"}${spoken ? " out loud" : ""}.`;
}
