import { getAnthropic, MODEL } from "@/lib/ai";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { attempts } from "@/lib/drill1/attempts";
import { getOrCreateGuestId } from "@/lib/guest";
import { takeAiBudget } from "@/lib/limits";
import { isProRequest } from "@/lib/pro";
import { ttsToken } from "@/lib/speech/server";
import {
  cleanAgenda,
  MAX_AGENDA_CHARS,
  MIN_AGENDA_CHARS,
  normalizeRehearse,
  REHEARSE_MIN,
  REHEARSE_SCHEMA,
  REHEARSE_SYSTEM,
  rehearseUserMessage,
} from "@/lib/rehearse/questions";

const NO_STORE = { "cache-control": "no-store" };
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
const errorJson = (status: number, error: string, code?: string) => Response.json({ error, code }, { status, headers: NO_STORE });

/**
 * POST /api/rehearse/questions `{ agenda }` → `{ items: [{ question, attemptId, ttsToken }] }` (Pro only; free → 402
 * `pro_required`). Claude writes the cold questions for this meeting; each one gets a server-issued drill 1 attempt
 * that stores the question, so POST /api/drill1/feedback grades it without trusting question text from the client.
 * Rehearse questions don't count against the free daily drill limit (Pro is unlimited anyway).
 */
export async function POST(request: Request) {
  try {
    const guestId = await getOrCreateGuestId();
    if (!(await isProRequest())) {
      return errorJson(402, "Rehearse my real meeting is part of Pro.", "pro_required");
    }
    const body = await readJsonBody(request, 16 * 1024);

    const agenda = cleanAgenda(body.agenda);
    if (agenda.length < MIN_AGENDA_CHARS) return errorJson(400, "Paste a bit more about the meeting: the agenda, who's there, what's being decided.", "agenda_short");
    if (agenda.length > MAX_AGENDA_CHARS) return errorJson(413, `Keep it under ${MAX_AGENDA_CHARS} characters.`, "agenda_long");

    const budget = takeAiBudget(request, guestId);
    if (!budget.ok) return errorJson(budget.status, budget.error, budget.code);

    let questions: ReturnType<typeof normalizeRehearse> = [];
    try {
      const message = await getAnthropic().beta.messages.create(
        {
          model: MODEL,
          max_tokens: 1200,
          output_config: { effort: "low", format: { type: "json_schema", schema: REHEARSE_SCHEMA } },
          system: REHEARSE_SYSTEM,
          messages: [{ role: "user", content: rehearseUserMessage(agenda) }],
          ...FALLBACK,
        },
        { signal: request.signal },
      );
      if (message.stop_reason === "max_tokens") console.warn("rehearse questions hit max_tokens; the JSON may be cut off.");
      const out = message.content.find((b) => b.type === "text");
      if (out && out.type === "text") {
        try {
          questions = normalizeRehearse(JSON.parse(out.text));
        } catch {
          questions = [];
        }
      }
    } catch (err) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("rehearse questions AI call failed:", err instanceof Error ? err.message : err);
      return errorJson(502, "We couldn't write your questions just now. Try again.", "ai_failed");
    }

    if (questions.length < REHEARSE_MIN) return errorJson(502, "We couldn't write good questions from that. Add a little more detail and try again.", "ai_failed");

    const items = questions.map((question) => ({ question, attemptId: attempts.create(guestId, question).id, ttsToken: ttsToken(question.text) }));
    return Response.json({ items }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error("POST /api/rehearse/questions failed:", err instanceof Error ? err.message : err);
    return errorJson(500, "Something went wrong. Try again.");
  }
}
