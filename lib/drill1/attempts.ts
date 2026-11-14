// Server-issued drill 1 attempts: POST /api/drill1/start creates one (and counts a drill against the free
// limit); POST /api/drill1/feedback must name it. In memory, per process (resets on restart, like lib/limits).
// "Rehearse my real meeting" (POST /api/rehearse/questions) issues attempts for AI-written questions: the question
// itself is kept here (`custom`), so feedback reads its text from the server, never from the client.

import type { ColdQuestion } from "./questions";

export const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;
/** Feedback calls allowed per attempt (re-grading after fixing the transcript). */
export const FEEDBACK_PER_ATTEMPT = 3;

export interface Attempt {
  id: string;
  guestId: string;
  questionId: string;
  createdAt: number;
  feedbackCount: number;
  /** A server-generated question (rehearse); its id equals `questionId`. Absent for bank questions. */
  custom?: ColdQuestion;
}

export class AttemptStore {
  private attempts = new Map<string, Attempt>();

  constructor(private readonly now: () => number = Date.now) {}

  /** A bank question by id, or a custom (server-generated) question kept with the attempt. */
  create(guestId: string, question: string | ColdQuestion): Attempt {
    this.sweep();
    const questionId = typeof question === "string" ? question : question.id;
    const custom = typeof question === "string" ? undefined : question;
    const a: Attempt = { id: crypto.randomUUID(), guestId, questionId, createdAt: this.now(), feedbackCount: 0, ...(custom ? { custom } : {}) };
    this.attempts.set(a.id, a);
    return a;
  }

  /** The live attempt with this id owned by this guest, or null. */
  get(id: unknown, guestId: string): Attempt | null {
    if (typeof id !== "string") return null;
    const a = this.attempts.get(id);
    if (!a || a.guestId !== guestId || this.now() - a.createdAt > ATTEMPT_TTL_MS) return null;
    return a;
  }

  private sweep() {
    if (this.attempts.size < 5_000) return;
    const t = this.now();
    for (const [k, v] of this.attempts) if (t - v.createdAt > ATTEMPT_TTL_MS) this.attempts.delete(k);
  }
}

// One store per process; kept on globalThis so dev hot reloads don't drop live attempts.
const g = globalThis as unknown as { __drill1Attempts?: AttemptStore };
export const attempts: AttemptStore = (g.__drill1Attempts ??= new AttemptStore());
