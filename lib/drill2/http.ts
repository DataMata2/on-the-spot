// Drill 2 route logic (server-only). Routes in app/api/drill2/* are thin wrappers around these handlers.
// The engine decides everything; hidden facts reach the client only inside the final grade.
import "server-only";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { getGuestId, getOrCreateGuestId } from "@/lib/guest";
import { takeAiBudget, takeDrillStart } from "@/lib/limits";
import { isProRequest } from "@/lib/pro";
import { characterReply, extract, offTopicReply } from "./ai";
import { changeBeforeConfirm, gradeConfirmation, publicScenario, revealFor, useHint } from "./engine";
import { getScenario, pickScenario } from "./scenarios";
import { drill2Sessions, MAX_TURNS, MAX_UTTERANCE_CHARS, type Drill2Session } from "./sessions";
import type { Grade } from "./types";

const NO_STORE = { "cache-control": "no-store" };
const BODY_LIMIT = 8 * 1024;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const fail = (status: number, error: string, code?: string) => json(code ? { error, code } : { error }, status);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function wrap(name: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    if (err instanceof HttpError) return fail(err.status, err.message, err.code);
    // fetch aborts throw AbortError; the Anthropic SDK throws APIUserAbortError.
    if (err instanceof Error && (err.name === "AbortError" || err.name === "APIUserAbortError")) return fail(499, "Request aborted.");
    console.error(`${name} failed:`, err instanceof Error ? err.message : err);
    return fail(500, "Something went wrong. Try again.");
  }
}

function readUtterance(body: Record<string, unknown>): string {
  const raw = typeof body.utterance === "string" ? body.utterance.replace(/\s+/g, " ").trim() : "";
  if (!raw) throw new HttpError(400, "Say or type something first.");
  if (raw.length > MAX_UTTERANCE_CHARS) throw new HttpError(413, `Keep it under ${MAX_UTTERANCE_CHARS} characters.`);
  return raw;
}

function readRequestId(body: Record<string, unknown>): string {
  const id = body.requestId;
  if (typeof id !== "string" || !REQUEST_ID_RE.test(id)) throw new HttpError(400, "requestId is missing.");
  return id;
}

async function loadSession(body: Record<string, unknown>): Promise<Drill2Session> {
  const guestId = await getGuestId();
  const id = body.sessionId;
  if (!guestId || typeof id !== "string" || !UUID_RE.test(id)) throw new HttpError(404, "This task has expired. Start a new one.", "session_gone");
  const session = drill2Sessions.get(id, guestId);
  if (!session) throw new HttpError(404, "This task has expired. Start a new one.", "session_gone");
  return session;
}

function spendAi(request: Request, guestId: string): void {
  const lim = takeAiBudget(request, guestId);
  if (!lim.ok) throw new HttpError(lim.status, lim.error, lim.code);
}

/** Progress the client may see: counts only, no values, no fact names. */
function progressOf(session: Drill2Session) {
  return {
    questionsAsked: session.state.questionsAsked,
    found: session.state.revealed.length,
    hiddenCount: session.scenario.hiddenFacts.length,
    turnsLeft: Math.max(0, MAX_TURNS - session.state.turns),
    hintsUsed: session.state.hintsUsed,
  };
}

/**
 * POST /api/drill2/start `{}` → `{ sessionId, scenario (public), progress, pro }`. The server picks the scenario
 * (the next one this guest hasn't done). Free guests get one try ever: then 402 `{ code: "drill2_pro" }`.
 */
export function startHandler() {
  return (request: Request) =>
    wrap("POST /api/drill2/start", async () => {
      await readJsonBody(request, BODY_LIMIT).catch(() => ({}));
      const guestId = await getOrCreateGuestId();
      const pro = await isProRequest();
      const lim = takeDrillStart(guestId, "drill2", pro);
      if (!lim.ok) return fail(lim.status, lim.error, lim.code);
      const scenario = pickScenario(drill2Sessions.done(guestId));
      const session = drill2Sessions.create(guestId, scenario);
      const transferFrom = scenario.transferOf ? getScenario(scenario.transferOf)?.title ?? null : null;
      return json({ sessionId: session.id, scenario: publicScenario(scenario), transferFrom, progress: progressOf(session), pro });
    });
}

export interface TurnResponse {
  requestId: string;
  reply: string;
  intent: "question" | "confirmation" | "other";
  newlyFound: number;
  offTopic: boolean;
  changed: boolean;
  suggestConfirm: boolean;
  progress: ReturnType<typeof progressOf>;
  /** Which path produced this turn (diagnostics; never secret). */
  source: { extractor: "ai" | "fallback"; character: "ai" | "verbatim" | "none" };
}

/**
 * POST /api/drill2/turn `{ sessionId, utterance, requestId }` → `TurnResponse`. A repeated requestId returns the
 * cached response without a new AI call.
 */
export function turnHandler() {
  return (request: Request) =>
    wrap("POST /api/drill2/turn", async () => {
      const body = await readJsonBody(request, BODY_LIMIT);
      const session = await loadSession(body);
      const requestId = readRequestId(body);
      const utterance = readUtterance(body);
      const result = await drill2Sessions.once(session, `turn:${requestId}`, async (): Promise<TurnResponse> => {
        if (session.grade) throw new HttpError(409, "You've already confirmed this task.", "already_confirmed");
        if (session.state.turns >= MAX_TURNS) throw new HttpError(429, "That's plenty of questions. Confirm the task now.", "turn_limit");
        spendAi(request, session.guestId);
        const ex = await extract(session.scenario, utterance, "turn", request.signal);
        // The new state is committed only once the reply is ready: an abort in between changes nothing, so a
        // retry with the same requestId (its cache entry is dropped on failure) doesn't count the turn twice.
        const turn = revealFor(session.scenario, session.state, ex.turn);

        const suggestConfirm = ex.turn.intent === "confirmation";
        const factLines = turn.allowedLines.filter((l) => l !== turn.changeLine);
        let reply: string;
        let character: TurnResponse["source"]["character"] = "none";
        if (suggestConfirm) {
          reply = "Sounds like you've got it. Tap “Confirm the task” and say it all back to me.";
        } else if (factLines.length) {
          const budget = takeAiBudget(request, session.guestId);
          if (budget.ok) {
            const c = await characterReply(session.scenario, turn.state, utterance, factLines, request.signal);
            reply = c.text;
            character = c.source;
          } else {
            reply = factLines.join(" ");
            character = "verbatim";
          }
        } else {
          reply = offTopicReply(turn.state.turns);
        }
        // The change is always said verbatim, so it can't be dropped or blurred.
        if (turn.changeLine) reply = `${reply} ${turn.changeLine}`;
        session.state = turn.state;
        session.thread.push({ role: "user", text: utterance }, { role: "manager", text: reply });
        return {
          requestId,
          reply,
          intent: ex.turn.intent,
          newlyFound: turn.newlyRevealed.length,
          offTopic: turn.offTopic,
          changed: Boolean(turn.changeLine),
          suggestConfirm,
          progress: progressOf(session),
          source: { extractor: ex.source, character },
        };
      });
      return json(result);
    });
}

/** POST /api/drill2/hint `{ sessionId, requestId }` → `{ hint, progress }`. A hint marks the run "with help". */
export function hintHandler() {
  return (request: Request) =>
    wrap("POST /api/drill2/hint", async () => {
      const body = await readJsonBody(request, BODY_LIMIT);
      const session = await loadSession(body);
      const requestId = readRequestId(body);
      const result = await drill2Sessions.once(session, `hint:${requestId}`, async () => {
        if (session.grade) throw new HttpError(409, "You've already confirmed this task.", "already_confirmed");
        const h = useHint(session.scenario, session.state);
        session.state = h.state;
        return { hint: h.hint ?? "You've found everything. Confirm the task.", progress: progressOf(session) };
      });
      return json(result);
    });
}

/**
 * The confirm route's answer when a condition change was still pending: no grade yet; the manager announces the
 * change and the user confirms again.
 */
export interface ConfirmChangeResponse {
  grade: null;
  reply: string;
  changed: true;
  progress: ReturnType<typeof progressOf>;
}

export interface ConfirmResponse {
  grade: Grade;
  utterance: string;
  input: "voice" | "typed" | "edited";
  source: "ai" | "fallback";
  thread: { role: "manager" | "user"; text: string }[];
}

/**
 * POST /api/drill2/confirm `{ sessionId, utterance, requestId, input? }` → `ConfirmResponse`. One grade per
 * session: a second confirm returns the first grade (no trial and error against the answer key).
 * When the scenario's condition change hasn't fired yet (a confirm before any turn), it fires here instead:
 * `ConfirmChangeResponse` (grade null, the manager's change line), and the user confirms again.
 */
export function confirmHandler() {
  return (request: Request) =>
    wrap("POST /api/drill2/confirm", async () => {
      const body = await readJsonBody(request, BODY_LIMIT);
      const session = await loadSession(body);
      const requestId = readRequestId(body);
      const utterance = readUtterance(body);
      const input = body.input === "typed" || body.input === "edited" ? body.input : "voice";
      if (!session.grade && session.scenario.change && !session.state.changeFired) {
        // Its own cache key, so the later real confirm still grades once under "confirm".
        const changed = await drill2Sessions.once(session, `confirm-change:${requestId}`, async (): Promise<ConfirmChangeResponse> => {
          const pending = changeBeforeConfirm(session.scenario, session.state);
          const reply = pending?.reply ?? "Go ahead, say it back to me.";
          if (pending) {
            session.state = pending.state;
            session.thread.push({ role: "user", text: utterance }, { role: "manager", text: reply });
          }
          return { grade: null, reply, changed: true, progress: progressOf(session) };
        });
        return json(changed);
      }
      const result = await drill2Sessions.once(session, "confirm", async (): Promise<ConfirmResponse> => {
        spendAi(request, session.guestId);
        const ex = await extract(session.scenario, utterance, "confirm", request.signal);
        session.grade = gradeConfirmation(session.scenario, session.state, ex.fields, { utterance });
        session.thread.push({ role: "user", text: utterance });
        return { grade: session.grade, utterance, input, source: ex.source, thread: session.thread };
      });
      void requestId;
      return json(result);
    });
}
