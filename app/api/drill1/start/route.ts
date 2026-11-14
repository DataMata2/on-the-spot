import { attempts } from "@/lib/drill1/attempts";
import { isQuestionType, juryQuestion, pickQuestion } from "@/lib/drill1/questions";
import { GuardError, guardResponse, readJsonBody } from "@/lib/ai-guard";
import { getOrCreateGuestId } from "@/lib/guest";
import { drillUsage, takeDrillStart } from "@/lib/limits";
import { isProRequest } from "@/lib/pro";

const NO_STORE = { "cache-control": "no-store" };

/**
 * POST /api/drill1/start `{ type?, excludeIds? }` → `{ question, attemptId, usage }`.
 * Starting a new question counts one drill against the free limit (3/day); over the limit → 402 `free_limit`.
 * `type` keeps a retry on the same question type; `excludeIds` (the questions already seen) keeps it a NEW question.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 4 * 1024);
    const type = isQuestionType(body.type) ? body.type : null;
    const excludeIds = Array.isArray(body.excludeIds)
      ? body.excludeIds.filter((x): x is string => typeof x === "string").slice(-50)
      : [];

    const guestId = await getOrCreateGuestId();
    const pro = await isProRequest();
    const limit = takeDrillStart(guestId, "drill1", pro);
    if (!limit.ok) {
      return Response.json({ error: limit.error, code: limit.code, usage: drillUsage(guestId, pro), pro }, { status: limit.status, headers: NO_STORE });
    }

    // A fresh guest's first questions follow the fixed jury order (their audio is pre-generated); a same-type retry
    // and later questions are random.
    const question = (type ? null : juryQuestion(excludeIds)) ?? pickQuestion(type, excludeIds);
    const attempt = attempts.create(guestId, question.id);
    return Response.json({ question, attemptId: attempt.id, usage: drillUsage(guestId, pro), pro }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error("POST /api/drill1/start failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500, headers: NO_STORE });
  }
}
