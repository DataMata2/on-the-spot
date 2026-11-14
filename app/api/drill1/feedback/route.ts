import { getAnthropic, MODEL } from "@/lib/ai";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { attempts, FEEDBACK_PER_ATTEMPT } from "@/lib/drill1/attempts";
import { MAX_TRANSCRIPT_CHARS, MIN_WORDS, runChecks } from "@/lib/drill1/checks";
import { buildFeedback, FEEDBACK_SCHEMA, FEEDBACK_SYSTEM, feedbackUserMessage, validateAi, type AiFeedback, type ValidatedAi } from "@/lib/drill1/feedback";
import { situationText } from "@/lib/drill1/questions";
import { getAnyQuestion } from "@/lib/drill1/roles";
import { getGuestId } from "@/lib/guest";
import { takeAiBudget } from "@/lib/limits";

const NO_STORE = { "cache-control": "no-store" };
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
const errorJson = (status: number, error: string, code?: string) => Response.json({ error, code }, { status, headers: NO_STORE });

/** The whole AI part of a request stays within this; a corrective second call is made only if the first ended before RETRY_IF_UNDER_MS. */
const TOTAL_BUDGET_MS = 25_000;
const RETRY_IF_UNDER_MS = 12_000;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * POST /api/drill1/feedback `{ attemptId, questionId, rawTranscript, editedTranscript? }` → Drill1Feedback.
 * The question text comes from the server (the bank by the attempt's question id, or the rehearse question
 * stored with the attempt), never from the client.
 * Too-short answers get `{ status: "too_short" }` with no AI call. When the AI call fails, the deterministic
 * checks are still returned (`aiAvailable: false`).
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    const guestId = await getGuestId();
    if (!guestId) return errorJson(400, "Start a drill first.", "no_attempt");
    const attempt = attempts.get(body.attemptId, guestId);
    if (!attempt || attempt.questionId !== body.questionId) return errorJson(400, "This question has expired. Start a new one.", "no_attempt");
    // A rehearse or "other" role attempt carries its own server-generated question; otherwise it comes from a bank.
    const question = attempt.custom ?? getAnyQuestion(attempt.questionId);
    if (!question) return errorJson(400, "Unknown question.", "no_attempt");

    const raw = clean(body.rawTranscript);
    const editedIn = clean(body.editedTranscript);
    const edited = editedIn.length > 0 && editedIn !== raw;
    const graded = edited ? editedIn : raw;
    if (raw.length > MAX_TRANSCRIPT_CHARS || graded.length > MAX_TRANSCRIPT_CHARS) {
      return errorJson(413, `That answer is too long. Keep it under ${MAX_TRANSCRIPT_CHARS} characters (about 45 seconds of speech).`, "too_long");
    }

    const checks = runChecks(graded);
    if (checks.words < MIN_WORDS) {
      return Response.json({ status: "too_short", message: "We didn't catch enough. Try again." }, { headers: NO_STORE });
    }
    if (attempt.feedbackCount >= FEEDBACK_PER_ATTEMPT) return errorJson(429, "That's enough feedback for this question. Try a new one.", "attempt_limit");

    const budget = takeAiBudget(request, guestId);
    if (!budget.ok) return errorJson(budget.status, budget.error, budget.code);
    attempt.feedbackCount += 1;

    // The server validates the model output before it reaches the client. When the model claims a quote that is
    // not in the transcript, or adds a number or day the user never said, ask once more (only while there is time
    // left in the overall budget); whatever is still invalid after that is shown in its safe form (the step as not
    // present, the number as a placeholder).
    const started = Date.now();
    let ai: AiFeedback | null = null;
    let issues: string[] = [];
    for (let call = 0; call < 2; call++) {
      const elapsed = Date.now() - started;
      if (call > 0 && elapsed > RETRY_IF_UNDER_MS) break;
      try {
        const message = await getAnthropic().beta.messages.create(
          {
            model: MODEL,
            max_tokens: 900,
            output_config: { effort: "low", format: { type: "json_schema", schema: FEEDBACK_SCHEMA } },
            system: FEEDBACK_SYSTEM,
            messages: [{ role: "user", content: feedbackUserMessage(question, graded) }],
            ...FALLBACK,
          },
          { signal: request.signal, timeout: Math.max(1_000, TOTAL_BUDGET_MS - elapsed), maxRetries: call > 0 ? 0 : undefined },
        );
        if (message.stop_reason === "max_tokens") console.warn("drill1 feedback hit max_tokens; the JSON may be cut off.");
        const out = message.content.find((b) => b.type === "text");
        let next: ValidatedAi = { ai: null, issues: ["no text"] };
        if (out && out.type === "text") {
          try {
            next = validateAi(JSON.parse(out.text), graded, situationText(question));
          } catch {
            next = { ai: null, issues: ["not JSON"] };
          }
        }
        // Keep the better of the two answers: a usable one over none, then the one with fewer corrections.
        if (next.ai && (!ai || next.issues.length < issues.length)) {
          ai = next.ai;
          issues = next.issues;
        }
        if (ai && issues.length === 0) break;
        console.warn(`drill1 feedback: model output needed corrections (call ${call + 1}): ${(next.ai ? next.issues : ["unusable"]).join("; ")}`);
        if (!next.ai && call > 0) break;
      } catch (err) {
        if (request.signal.aborted) return new Response(null, { status: 499 });
        console.error("drill1 feedback AI call failed:", err instanceof Error ? err.message : err);
        break;
      }
    }

    return Response.json(buildFeedback({ questionId: question.id, graded, edited, checks, ai }), { headers: NO_STORE });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error("POST /api/drill1/feedback failed:", err instanceof Error ? err.message : err);
    return errorJson(500, "Something went wrong. Try again.");
  }
}
