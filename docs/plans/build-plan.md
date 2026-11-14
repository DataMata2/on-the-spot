# On the Spot — build plan (orchestrator-owned)

Spec: `../../PRODUCT-B.md` (read it). Jury rules: `../../CASE.md` "Case Q&A answers".
Goal order: a testable URL fast. Milestone 1 (~22:30): drill 1 works locally end to end in Chrome.
Milestone 2 (~00:30): deployed; paywall + Stripe test checkout → Pro; drill 2 with deterministic engine + tests.

## Repo state
`app-b/` was copied from product A (`../app`, "Penaltyproof"): Next.js 16 (App Router, read
`node_modules/next/dist/docs/` before using unfamiliar APIs — this Next differs from training data),
Tailwind v4, shadcn, pnpm, vitest. Copied: `lib/{ai,guest,stripe,supabase,utils,ai-guard}.ts`,
`components/{ui,kit}`, `app/{layout.tsx,globals.css}`, `app/api/{health,guest,checkout,stripe}`,
`app/checkout/success`, Dockerfile, compose, `scripts/deploy.sh`. These still reference Penaltyproof
and A's modules (`@/lib/product/...`) in places — the plumbing task fixes them.
`.env.local` has ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Never print/commit.

## Decisions
- **No Supabase tonight.** No way to create a project from here. Progress = localStorage on the client.
  Pro status = an httpOnly HMAC-signed cookie `ots_pro`, set only after the server retrieves the Stripe
  Checkout Session and verifies `status=complete`, `payment_status=paid` (or subscription active) and
  `metadata.guestId == guest cookie`. Never grant Pro from a query param alone. HMAC secret: env
  `PRO_COOKIE_SECRET` (falls back to a hash of STRIPE_SECRET_KEY). `lib/supabase.ts` stays but unused,
  or delete it — the app must run with no SUPABASE env.
- **STT:** browser Web Speech API (`webkitSpeechRecognition`, en-US, interimResults, continuous) behind an
  interface so server STT can be swapped in later. "Type instead" always available.
- **TTS:** `speechSynthesis`, prefer an en-US voice; text always shown.
- **Model:** `claude-sonnet-5-5` via `lib/ai.ts`. Use structured JSON output (tool use / JSON schema), short
  max_tokens, abort with request signal.
- **Free tier:** 3 drills/day per guest, enforced server-side (in-memory per guest id per UTC day) and
  shown client-side. Drill 2: one free try per guest. Pro = unlimited + drill 2 + "rehearse my real meeting"
  (that feature may be a stub card "coming in Pro" if time is short — mark it honestly).
- **Prices:** Pro $12/month, $79/year (yearly shown first as better value). Stripe subscription via inline
  `price_data` like A. Test card shown on paywall: 4242 4242 4242 4242, any future date, any CVC.
- English UI. Never mention accent or pronunciation scoring except "we never score your accent".

## Shared interfaces (owned by Task P, consumed by D1/D2 — code against these exact signatures)
```ts
// lib/limits.ts  (server-only)
export type LimitResult = { ok: true } | { ok: false; status: 402 | 429; error: string; code: "free_limit" | "rate_limited" | "drill2_pro" };
/** AI-call budget: per guest 60/h, per IP 400/h, global 2000/h (reuse lib/ai-guard.ts AiLimits). */
export function takeAiBudget(req: Request, guestId: string | null): LimitResult;
/** Counts one started drill for today (UTC). Free: 3/day for drill1; drill2 1 try ever (in-memory). Pro: unlimited. */
export function takeDrillStart(guestId: string, drill: "drill1" | "drill2", pro: boolean): LimitResult;
/** Read-only view for the UI. */
export function drillUsage(guestId: string, pro: boolean): { usedToday: number; freePerDay: 3; drill2FreeUsed: boolean };
// lib/pro.ts (server-only)
export async function isProRequest(): Promise<boolean>; // reads + verifies the ots_pro cookie for the current guest
```
Until P lands, D1/D2 may create these two files with exactly these signatures as permissive stubs
(always ok / false) IF the files don't exist; P overwrites them. Guest id: `getOrCreateGuestId()` from `lib/guest.ts`.

## Tasks and file ownership (do not edit files outside your ownership; if you must, say so in the report)
- **P — plumbing, paywall, deploy prep.** Owns: `lib/{stripe,guest,supabase,limits,pro,ai,ai-guard}.ts`,
  `app/api/{checkout,stripe,health,guest,pro}/**`, `app/checkout/**`, `app/pricing/**`, `components/paywall/**`,
  `app/layout.tsx`, `app/globals.css`, `components/site/**` (header/footer), Dockerfile, docker-compose.yml,
  `scripts/**`, `.env.example`, `README.md`, `.gitignore`.
- **D1 — drill 1 + landing + progress card.** Owns: `app/page.tsx` (landing), `app/drill/**`,
  `app/progress/**` (or progress inside drill flow), `components/drill/**`, `components/progress/**`,
  `components/voice/**` (shared voice hooks: TTS, STT, push-to-talk, think timer, transcript editor — D2 reuses),
  `lib/drill1/**`, `lib/progress/**` (localStorage progress store), `app/api/drill1/**`.
- **D2 — drill 2 engine + UI.** Owns: `lib/drill2/**` (pure deterministic engine + scenarios + tests),
  `app/api/drill2/**`, `app/clarify/**`, `components/clarify/**`. Reuses `components/voice/**` read-only
  (if D1's hooks aren't there yet, build the engine + API first and the UI last).
