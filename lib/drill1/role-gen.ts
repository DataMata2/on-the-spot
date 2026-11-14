// Drill 1 "Other" role, the I/O part: one AI call per guest + role text, cached in memory (per process, like the
// attempts), counted against the AI budget. Every failure (no budget, timeout, API error, invalid output) returns
// null, and the caller silently serves the general bank. A failure is remembered for a while, so a guest whose
// text can't be used doesn't pay an AI call on every start.
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { ColdQuestion } from "./questions";
import { ROLE_GEN_SCHEMA, ROLE_GEN_SYSTEM, roleGenUserMessage, validateRoleQuestions } from "./role-ai";

const OK_TTL_MS = 2 * 60 * 60 * 1000;
const FAIL_TTL_MS = 10 * 60 * 1000;
/** The start request waits at most this long for the questions. */
export const ROLE_GEN_TIMEOUT_MS = 12_000;
const MAX_ENTRIES = 5_000;

/** The one Anthropic call this makes: `getAnthropic().beta.messages.create` in the route, a fake in tests. */
export type RoleGenCreate = (
  params: MessageCreateParamsNonStreaming,
  opts: { signal?: AbortSignal; timeout?: number; maxRetries?: number },
) => Promise<{ stop_reason?: string | null; content: { type: string; text?: string }[] }>;

export interface RoleGenDeps {
  create: RoleGenCreate;
  model: string;
  /** One AI call against the budget; false = over it. */
  takeBudget: () => boolean;
  now?: () => number;
}

interface Entry {
  questions: ColdQuestion[] | null;
  at: number;
}

const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export class RoleQuestionCache {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<ColdQuestion[] | null>>();

  /**
   * The generated questions for this guest + role text (cached), or null (use the general bank). `roleText` must
   * already be validated (cleanRoleText).
   */
  async get(guestId: string, roleText: string, deps: RoleGenDeps, signal?: AbortSignal): Promise<ColdQuestion[] | null> {
    const now = (deps.now ?? Date.now)();
    const key = `${guestId}\n${roleText.toLowerCase()}`;
    const hit = this.entries.get(key);
    if (hit && now - hit.at < (hit.questions ? OK_TTL_MS : FAIL_TTL_MS)) return hit.questions;
    const running = this.inflight.get(key);
    if (running) return running;
    const job = this.generate(roleText, deps, signal)
      .then((questions) => {
        // A request the client walked away from proves nothing about the text: don't cache that failure.
        if (questions || !signal?.aborted) this.set(key, { questions, at: now });
        return questions;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  private set(key: string, entry: Entry) {
    if (this.entries.size >= MAX_ENTRIES) this.entries.clear();
    this.entries.set(key, entry);
  }

  private async generate(roleText: string, deps: RoleGenDeps, signal?: AbortSignal): Promise<ColdQuestion[] | null> {
    if (!deps.takeBudget()) return null;
    try {
      const message = await deps.create(
        {
          model: deps.model,
          max_tokens: 900,
          output_config: { effort: "low", format: { type: "json_schema", schema: ROLE_GEN_SCHEMA } },
          system: ROLE_GEN_SYSTEM,
          messages: [{ role: "user", content: roleGenUserMessage(roleText) }],
          ...FALLBACK,
        },
        { signal, timeout: ROLE_GEN_TIMEOUT_MS, maxRetries: 0 },
      );
      if (message.stop_reason === "max_tokens") console.warn("drill1 role questions hit max_tokens; the JSON may be cut off.");
      const out = message.content.find((b) => b.type === "text");
      if (!out?.text) return null;
      const questions = validateRoleQuestions(JSON.parse(out.text));
      if (!questions) console.warn("drill1 role questions: model output failed validation; using the general bank.");
      return questions;
    } catch (err) {
      if (!signal?.aborted) console.warn("drill1 role questions AI call failed:", err instanceof Error ? err.message : "error");
      return null;
    }
  }
}

// One cache per process; kept on globalThis so dev hot reloads keep it.
const g = globalThis as unknown as { __drill1RoleQuestions?: RoleQuestionCache };
export const roleQuestions: RoleQuestionCache = (g.__drill1RoleQuestions ??= new RoleQuestionCache());
