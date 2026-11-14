import { getAnthropic, MODEL } from "@/lib/ai";
import { attempts } from "@/lib/drill1/attempts";
import { isQuestionType, juryQuestion, pickQuestion, type ColdQuestion, type QuestionType } from "@/lib/drill1/questions";
import { roleQuestions } from "@/lib/drill1/role-gen";
import { parseRole, pickForRole } from "@/lib/drill1/roles";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { getOrCreateGuestId } from "@/lib/guest";
import { drillUsage, takeAiBudget, takeDrillStart } from "@/lib/limits";
import { isProRequest } from "@/lib/pro";
import { ttsToken } from "@/lib/speech/server";

const NO_STORE = { "cache-control": "no-store" };

/** The general bank: a fresh guest's first questions follow the fixed jury order (pre-generated audio), then random. */
const general = (type: QuestionType | null, excludeIds: readonly string[]) => (type ? null : juryQuestion(excludeIds)) ?? pickQuestion(type, excludeIds);

/**
 * POST /api/drill1/start `{ type?, excludeIds?, role?, roleText? }` → `{ question, attemptId, ttsToken?, usage }`.
 * Starting a new question counts one drill against the free limit (3/day); over the limit → 402 `free_limit`.
 * `type` keeps a retry on the same question type; `excludeIds` (the questions already seen) keeps it a NEW question.
 * `role` (lib/drill1/roles.ts ROLE_IDS; anything else = general) picks the bank. For "other", `roleText` (≤ 60 chars)
 * is turned into questions by the AI (one call per guest + text, cached); on any failure the general bank is used.
 * A generated question comes with `ttsToken` so POST /api/speech/tts will voice it.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 4 * 1024);
    const type = isQuestionType(body.type) ? body.type : null;
    const excludeIds = Array.isArray(body.excludeIds)
      ? body.excludeIds.filter((x): x is string => typeof x === "string").slice(-50)
      : [];
    const role = parseRole(body.role, body.roleText) ?? { id: "general" as const };

    const guestId = await getOrCreateGuestId();
    const pro = await isProRequest();
    const limit = takeDrillStart(guestId, "drill1", pro);
    if (!limit.ok) {
      return Response.json({ error: limit.error, code: limit.code, usage: drillUsage(guestId, pro), pro }, { status: limit.status, headers: NO_STORE });
    }

    let pool: ColdQuestion[] | undefined;
    if (role.id === "other" && role.text) {
      const generated = await roleQuestions.get(
        guestId,
        role.text,
        { create: (params, opts) => getAnthropic().beta.messages.create(params, opts), model: MODEL, takeBudget: () => takeAiBudget(request, guestId).ok },
        request.signal,
      );
      if (request.signal.aborted) return new Response(null, { status: 499 });
      pool = generated ?? undefined;
    }

    const question = pickForRole(role.id, type, excludeIds, { pool, general });
    // A generated question is kept with its attempt (feedback reads it from there) and gets a TTS token; bank
    // questions (general and role banks) are found by id and are on the static TTS allow-list.
    const custom = pool?.includes(question) ?? false;
    const attempt = attempts.create(guestId, custom ? question : question.id);
    return Response.json(
      { question, attemptId: attempt.id, ...(custom ? { ttsToken: ttsToken(question.text) } : {}), usage: drillUsage(guestId, pro), pro },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error("POST /api/drill1/start failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500, headers: NO_STORE });
  }
}
