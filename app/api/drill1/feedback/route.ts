import { getAnthropic, MODEL } from "@/lib/ai";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { attempts, FEEDBACK_PER_ATTEMPT } from "@/lib/drill1/attempts";
import { MAX_TRANSCRIPT_CHARS, MIN_WORDS, runChecks } from "@/lib/drill1/checks";
import { buildFeedback, FEEDBACK_SCHEMA, FEEDBACK_SYSTEM, feedbackUserMessage, normalizeAi, type AiFeedback } from "@/lib/drill1/feedback";
import { getQuestion } from "@/lib/drill1/questions";
import { getGuestId } from "@/lib/guest";
import { takeAiBudget } from "@/lib/limits";

const NO_STORE = { "cache-control": "no-store" };
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
const errorJson = (status: number, error: string, code?: string) => Response.json({ error, code }, { status, headers: NO_STORE });

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * POST /api/drill1/feedback `{ attemptId, questionId, rawTranscript, editedTranscript? }` → Drill1Feedback.
 * The question text comes from the server's bank (by the attempt's question id), never from the client.
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
    const question = getQuestion(attempt.questionId);
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

    let ai: AiFeedback | null = null;
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
        { signal: request.signal },
      );
      if (message.stop_reason === "max_tokens") console.warn("drill1 feedback hit max_tokens; the JSON may be cut off.");
      const out = message.content.find((b) => b.type === "text");
      if (out && out.type === "text") {
        try {
          ai = normalizeAi(JSON.parse(out.text), graded);
        } catch {
          ai = null;
        }
      }
    } catch (err) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("drill1 feedback AI call failed:", err instanceof Error ? err.message : err);
    }

    return Response.json(buildFeedback({ questionId: question.id, graded, edited, checks, ai }), { headers: NO_STORE });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error("POST /api/drill1/feedback failed:", err instanceof Error ? err.message : err);
    return errorJson(500, "Something went wrong. Try again.");
  }
}
