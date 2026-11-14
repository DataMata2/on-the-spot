// In-memory drill 2 sessions (no DB tonight): one process, lost on restart, swept by TTL. No Next imports.

import { createState } from "./engine";
import type { DrillState, Grade, Scenario } from "./types";

export const SESSION_TTL_MS = 45 * 60 * 1000;
export const MAX_SESSIONS = 5_000;
/** User turns (questions and anything else) per session before they must confirm. */
export const MAX_TURNS = 12;
/** Longest utterance accepted, in characters (about 45 s of speech). */
export const MAX_UTTERANCE_CHARS = 600;

export interface ThreadItem {
  role: "manager" | "user";
  text: string;
}

export interface Drill2Session {
  id: string;
  guestId: string;
  scenario: Scenario;
  state: DrillState;
  thread: ThreadItem[];
  createdAt: number;
  lastAt: number;
  /** Cached turn results by client request id: a duplicate returns the cached result, no new AI call. */
  results: Map<string, Promise<unknown>>;
  grade: Grade | null;
  /** Serialises state changes within the session. */
  queue: Promise<unknown>;
}

export class SessionStore {
  private sessions = new Map<string, Drill2Session>();
  private history = new Map<string, string[]>();

  constructor(
    private readonly ttlMs = SESSION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  create(guestId: string, scenario: Scenario): Drill2Session {
    this.sweep();
    const t = this.now();
    const session: Drill2Session = {
      id: crypto.randomUUID(),
      guestId,
      scenario,
      state: createState(scenario),
      thread: [{ role: "manager", text: scenario.managerLine }],
      createdAt: t,
      lastAt: t,
      results: new Map(),
      grade: null,
      queue: Promise.resolve(),
    };
    this.sessions.set(session.id, session);
    const done = this.history.get(guestId) ?? [];
    this.history.set(guestId, [...done.filter((x) => x !== scenario.id), scenario.id]);
    return session;
  }

  /** The session if it exists, belongs to this guest and hasn't expired. */
  get(id: string, guestId: string): Drill2Session | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (this.now() - s.lastAt > this.ttlMs) {
      this.sessions.delete(id);
      return null;
    }
    if (s.guestId !== guestId) return null;
    s.lastAt = this.now();
    return s;
  }

  /** Scenario ids this guest has started, oldest first. */
  done(guestId: string): string[] {
    return this.history.get(guestId) ?? [];
  }

  /**
   * Run `fn` once per request id, serialised with the session's other work. A repeated id gets the first
   * result (even while it is still running).
   */
  once<T>(session: Drill2Session, requestId: string, fn: () => Promise<T>): Promise<T> {
    const cached = session.results.get(requestId);
    if (cached) return cached as Promise<T>;
    const run = session.queue.then(fn, fn);
    session.queue = run.catch(() => undefined);
    session.results.set(requestId, run);
    // A failed run may be retried with the same id.
    run.catch(() => session.results.delete(requestId));
    return run;
  }

  private sweep() {
    const t = this.now();
    for (const [id, s] of this.sessions) if (t - s.lastAt > this.ttlMs) this.sessions.delete(id);
    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.lastAt - b.lastAt).slice(0, this.sessions.size - MAX_SESSIONS + 1);
      for (const s of oldest) this.sessions.delete(s.id);
    }
    if (this.history.size > 50_000) this.history.clear();
  }

  get size() {
    return this.sessions.size;
  }
}

/** One store per server process (on globalThis so dev-mode module reloads don't split it). */
const g = globalThis as typeof globalThis & { __drill2Sessions?: SessionStore };
export const drill2Sessions: SessionStore = (g.__drill2Sessions ??= new SessionStore());
