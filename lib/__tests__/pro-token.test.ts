import { describe, expect, it, vi } from "vitest";
import { PRO_DURATION_MS, proExpiryFromCheckout, proSecretFromEnv, signProToken, verifyProToken } from "@/lib/pro-token";

const SECRET = "test-secret";
const GUEST = "6f1c2b7e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";
const OTHER = "11111111-2222-4333-8444-555555555555";
const NOW = Date.parse("2026-11-14T12:00:00Z");
const LATER = NOW + 30 * 24 * 60 * 60 * 1000;

describe("Pro cookie token", () => {
  it("verifies a token it signed for the same guest before expiry", () => {
    expect(verifyProToken(signProToken(GUEST, LATER, SECRET), GUEST, SECRET, NOW)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = signProToken(GUEST, LATER, SECRET);
    const [g, exp, sig] = token.split(".");
    expect(verifyProToken(`${g}.${Number(exp) + 1000}.${sig}`, GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken(`${OTHER}.${exp}.${sig}`, OTHER, SECRET, NOW)).toBe(false);
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifyProToken(`${g}.${exp}.${flipped}`, GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken(token, GUEST, "another-secret", NOW)).toBe(false);
  });

  it("rejects a valid token presented by another guest", () => {
    expect(verifyProToken(signProToken(GUEST, LATER, SECRET), OTHER, SECRET, NOW)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signProToken(GUEST, NOW - 1, SECRET);
    expect(verifyProToken(token, GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken(signProToken(GUEST, LATER, SECRET), GUEST, SECRET, LATER + 1)).toBe(false);
  });

  it("rejects missing or malformed input", () => {
    expect(verifyProToken(undefined, GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken("", GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken("1", GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken("pro=1", GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken(`${GUEST}.abc.def`, GUEST, SECRET, NOW)).toBe(false);
    expect(verifyProToken(signProToken(GUEST, LATER, SECRET), null, SECRET, NOW)).toBe(false);
  });

  it("derives the secret from PRO_COOKIE_SECRET, else from STRIPE_SECRET_KEY", () => {
    expect(proSecretFromEnv({ PRO_COOKIE_SECRET: "abc", STRIPE_SECRET_KEY: "x" })).toBe("abc");
    const derived = proSecretFromEnv({ STRIPE_SECRET_KEY: "x" });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toContain("x".repeat(2));
    expect(proSecretFromEnv({})).toBeNull();
  });
});

// TM-SHARED-04: the expiry comes from Stripe's data, so re-claiming a session never extends Pro.
describe("proExpiryFromCheckout", () => {
  const created = Date.parse("2026-11-14T17:50:00Z") / 1000;
  const periodEnd = Date.parse("2026-12-14T17:50:00Z") / 1000;

  it("uses the subscription's current period end when it is expanded", () => {
    const s = { created, subscription: { items: { data: [{ current_period_end: periodEnd }] } } };
    expect(proExpiryFromCheckout(s, "month")).toBe(periodEnd * 1000);
  });

  it("falls back to the session's creation plus the plan duration", () => {
    expect(proExpiryFromCheckout({ created, subscription: "sub_123" }, "month")).toBe(created * 1000 + PRO_DURATION_MS.month);
    expect(proExpiryFromCheckout({ created, subscription: null }, "year")).toBe(created * 1000 + PRO_DURATION_MS.year);
    expect(proExpiryFromCheckout({ created, subscription: { items: { data: [] } } }, "year")).toBe(created * 1000 + PRO_DURATION_MS.year);
  });

  it("is the same on every claim, whatever the clock says", () => {
    const s = { created, subscription: "sub_123" };
    const first = proExpiryFromCheckout(s, "month");
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-11-20T00:00:00Z"));
    try {
      expect(proExpiryFromCheckout(s, "month")).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

