// Signed Pro token kept in the httpOnly `ots_pro` cookie: "<guestId>.<expiresAtMs>.<sig>", where sig is
// HMAC-SHA256(secret, "<guestId>.<expiresAtMs>") in base64url. Pure (node:crypto only, no Next imports), so
// it is unit-tested directly. lib/pro.ts wires it to cookies and env.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Name of the httpOnly cookie that holds the Pro token. */
export const PRO_COOKIE = "ots_pro";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a grant lasts per billing interval (a little slack past one period). */
export const PRO_DURATION_MS = { month: 32 * DAY_MS, year: 367 * DAY_MS } as const;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Builds the cookie value for a guest whose Pro access ends at `expiresAt` (ms since epoch). */
export function signProToken(guestId: string, expiresAt: number, secret: string): string {
  const exp = Math.floor(expiresAt);
  const payload = `${guestId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * True only when `token` was signed with `secret`, belongs to `guestId` and has not expired at `now`.
 * Any malformed input answers false.
 */
export function verifyProToken(
  token: string | null | undefined,
  guestId: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!token || !guestId || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenGuest, expRaw, sig] = parts;
  if (!/^\d{1,16}$/.test(expRaw)) return false;
  const expected = Buffer.from(sign(`${tokenGuest}.${expRaw}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  if (tokenGuest !== guestId) return false;
  return Number(expRaw) > now;
}

/** The HMAC secret: PRO_COOKIE_SECRET, else sha256 of STRIPE_SECRET_KEY; null when neither is set. */
export function proSecretFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.PRO_COOKIE_SECRET?.trim();
  if (explicit) return explicit;
  const stripe = env.STRIPE_SECRET_KEY?.trim();
  if (stripe) return createHash("sha256").update(`ots_pro:${stripe}`).digest("hex");
  return null;
}
