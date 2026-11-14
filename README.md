# On the Spot

Answer on the spot at work. Short spoken drills for the moments English at work goes quiet: someone asks
you a question in a meeting, or hands you a vague task. You hear the prompt, think for a few seconds, answer
out loud, get one clear fix, and try again. We never score your accent: feedback is about whether the answer
landed.

- **Drill 1, answer on the spot** (`/drill`): a work question, a short think timer, speak, get feedback, retry.
- **Drill 2, clarify the vague task** (`/clarify`): ask the questions that turn a vague request into a clear one.
  Graded by a deterministic engine.
- **Progress** (`/progress`): kept in this browser (localStorage). No sign-up.
- **Pro** (`/pricing`): $12/month or $79/year. Unlimited drills, drill 2, a daily plan, "rehearse my real meeting"
  (listed as coming soon until it ships). Free tier: 3 drills a day and one try of drill 2.

## Stack

Next.js 16 (App Router, Cache Components, standalone output), TypeScript, Tailwind CSS v4, pnpm, vitest.
Anthropic API (`claude-sonnet-5-5`) on the server for feedback. Browser Web Speech API for speech-to-text
(with "type instead"), `speechSynthesis` for the prompt voice. Stripe Checkout in test mode. No database.

## Run locally

```bash
pnpm i
cp .env.example .env.local   # fill in values
pnpm dev                     # http://localhost:3000
pnpm test                    # unit tests
pnpm lint && pnpm build
```

## Environment variables

| Name | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Server-side key for Claude calls. |
| `STRIPE_SECRET_KEY` | Stripe secret key. Must be a test-mode key; the app refuses anything else. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (test mode). Build-time. |
| `STRIPE_WEBHOOK_SECRET` | Optional. Signing secret for `/api/stripe/webhook`; the webhook answers 503 when unset. |
| `PRO_COOKIE_SECRET` | Optional. HMAC secret for the `ots_pro` cookie; defaults to a SHA-256 of `STRIPE_SECRET_KEY`. |
| `APP_URL` | Optional. Public base URL for Stripe redirects; else the request origin (honours `x-forwarded-host`/`-proto`). |
| `APP_PORT` | Host port for docker compose (default 3200, bound to 127.0.0.1). |
| `PROXY_NETWORK`, `PROXY_EXTERNAL` | Docker network shared with the reverse proxy (deploy only). |

## Routes

Pages: `/` landing, `/drill`, `/clarify`, `/progress`, `/pricing`, `/checkout/success`.

API:

- `POST /api/guest` creates the guest cookie, returns `{ guestId }`.
- `POST /api/checkout` with `{ plan: "yearly" | "monthly" }` (JSON → `{ url }`, form → 303 to Stripe).
- `GET /api/pro/claim?session_id=` verifies a Checkout Session with Stripe and sets the Pro cookie.
- `GET /api/pro` → `{ pro }` for this browser.
- `POST /api/stripe/webhook` verifies the signature and acknowledges (logs completed checkouts).
- `GET /api/health` checks Anthropic and Stripe; 200 when both are ok, else 503.
- `/api/drill1/*`, `/api/drill2/*` drill endpoints.

## Guest, Pro and limits

- Guest: an httpOnly `guest_id` cookie (UUID), set by `getOrCreateGuestId()` in `lib/guest.ts`.
- Pro: an httpOnly cookie `ots_pro` = `<guestId>.<expiresAtMs>.<HMAC-SHA256>`. It is set only by
  `/api/pro/claim`, after the server retrieves the Checkout Session from Stripe and checks `status=complete`,
  `payment_status=paid` and `metadata.guestId` equal to the guest cookie. A query parameter alone never grants
  Pro. `isProRequest()` in `lib/pro.ts` verifies it. Pro is tied to the browser that paid.
- Limits (`lib/limits.ts`, in memory, reset on restart): free guests get 3 drill-1 starts per UTC day and one
  drill-2 try; AI calls are capped per guest (60/h), per IP (400/h) and globally (2000/h).

## Stripe (test mode only)

Plans are created inline with `price_data` (subscription), so no Stripe products or prices need to exist. Pay
with the test card `4242 4242 4242 4242`, any future date, any CVC. After payment Stripe returns to
`/checkout/success?session_id=…`, which hands the session to `/api/pro/claim`. In production the cookies are
`Secure`, so Pro needs HTTPS.

## Docker / deploy

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
curl http://127.0.0.1:3200/api/health
```

Compose project `on-the-spot`, container `on-the-spot-app`. `scripts/deploy.sh` ships `origin/main` to
`/home/ubuntu/on-the-spot` on the server and rebuilds the container there.
