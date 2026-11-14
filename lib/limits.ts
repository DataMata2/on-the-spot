import "server-only";
import { AiLimits, clientIp, RATE_LIMITED_MESSAGE, RateLimiter } from "@/lib/ai-guard";
import { DrillLimits, type LimitResult } from "@/lib/limits-core";

export type { LimitResult } from "@/lib/limits-core";
export { FREE_DRILLS_PER_DAY } from "@/lib/limits-core";

/** AI calls per hour: per guest, per IP, for the whole process. */
export const AI_GUEST_PER_HOUR = 60;
export const AI_IP_PER_HOUR = 1500;
export const AI_GLOBAL_PER_HOUR = 3000;

const aiBudget = new AiLimits(
  new RateLimiter(AI_GUEST_PER_HOUR),
  new RateLimiter(AI_IP_PER_HOUR),
  new RateLimiter(AI_GLOBAL_PER_HOUR),
);
const drills = new DrillLimits();

/** Speech calls per hour (ElevenLabs STT + TTS cache misses), separate from the AI budget: per guest, IP, process. */
export const SPEECH_GUEST_PER_HOUR = 120;
export const SPEECH_IP_PER_HOUR = 1500;
export const SPEECH_GLOBAL_PER_HOUR = 3000;

const speechBudget = new AiLimits(
  new RateLimiter(SPEECH_GUEST_PER_HOUR),
  new RateLimiter(SPEECH_IP_PER_HOUR),
  new RateLimiter(SPEECH_GLOBAL_PER_HOUR),
);

/** One speech call against the per-guest / per-IP / global hourly limits; false when over any of them. */
export function takeSpeechBudget(req: Request, guestId: string | null): boolean {
  return speechBudget.take({ guestId, ip: clientIp(req.headers) });
}

/** AI-call budget: per guest 60/h, per IP 1500/h (venue Wi-Fi shares one IP), global 3000/h (reuse lib/ai-guard.ts AiLimits). */
export function takeAiBudget(req: Request, guestId: string | null): LimitResult {
  if (aiBudget.take({ guestId, ip: clientIp(req.headers) })) return { ok: true };
  return { ok: false, status: 429, error: RATE_LIMITED_MESSAGE, code: "rate_limited" };
}

/** Counts one started drill for today (UTC). Free: 3/day for drill1; drill2 1 try ever (in-memory). Pro: unlimited. */
export function takeDrillStart(guestId: string, drill: "drill1" | "drill2", pro: boolean): LimitResult {
  return drills.take(guestId, drill, pro);
}

/** Read-only view for the UI. */
export function drillUsage(guestId: string, pro: boolean): { usedToday: number; freePerDay: 3; drill2FreeUsed: boolean } {
  return drills.usage(guestId, pro);
}
