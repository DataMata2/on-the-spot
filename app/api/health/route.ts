import { connection } from "next/server";
import { getAnthropic, MODEL } from "@/lib/ai";
import { getStripe } from "@/lib/stripe";

type Check = { ok: boolean; ms: number; error?: string };

// The model can take ~8 s to answer even a 5-token ping; leave headroom.
const TIMEOUT_MS = 20_000;
const SECRET_ENV = ["ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PRO_COOKIE_SECRET"];

/** Strips secret values and key-like tokens from an error message. */
function sanitize(message: string): string {
  let out = message;
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value) out = out.split(value).join("[redacted]");
  }
  return out
    .replace(/(sk|pk|rk|whsec)_(test|live)?_?[A-Za-z0-9]+/g, "[redacted]")
    .replace(/sk-[a-z]{3}-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 300);
}

/** Runs fn with a timeout and reports { ok, ms, error? }. */
async function timed(fn: () => Promise<void>): Promise<Check> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      }),
    ]);
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: sanitize(err instanceof Error ? err.message : String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAnthropic() {
  await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 5,
    messages: [{ role: "user", content: "ping" }],
  });
}

async function checkStripe() {
  const balance = await getStripe().balance.retrieve();
  if (balance.livemode) throw new Error("Stripe is in live mode");
}

/** GET /api/health: checks Anthropic and Stripe (test mode); 200 if both ok, else 503. No database is used. */
export async function GET() {
  await connection();
  const [anthropic, stripe] = await Promise.all([timed(checkAnthropic), timed(checkStripe)]);
  const checks = { anthropic, stripe };
  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
