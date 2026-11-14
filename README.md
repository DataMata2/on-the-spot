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
Anthropic API (`claude-sonnet-5-5`) on the server for feedback. Speech: ElevenLabs when `ELEVENLABS_API_KEY` is
set (Scribe v3 speech-to-text, Flash v2.5 voice), with the browser's Web Speech API and `speechSynthesis` as the
silent fallback (and the only engine without a key). "Type instead" is always there. Stripe Checkout in test mode.
No database.

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
| `ELEVENLABS_API_KEY` | Optional. Turns on ElevenLabs speech (needs the TTS and STT permissions; `user_read` lets it read the live balance). Without it the app uses browser speech only. |
| `ELEVENLABS_VOICE_ID` | Optional. TTS voice (default `cjVigY5qzO86Huf0OWal`, "Eric", a Default voice: free accounts can't use Voice Library voices over the API). |
| `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | Optional. Defaults `eleven_flash_v2_5` and `scribe_v3`. |
| `ELEVENLABS_DAILY_TTS_CHARS` | Optional. Daily (UTC) cap on generated TTS characters (default 3000; cache hits are free). |
| `ELEVENLABS_DAILY_STT_SECONDS` | Optional. Daily (UTC) cap on transcribed audio seconds (default 600). |
| `ELEVENLABS_RESERVE_UNTIL`, `ELEVENLABS_RESERVE_CREDITS` | Optional. Until this time (default `2026-11-15T07:00:00Z`) keep this many credits untouched (default 3000). |
| `ELEVENLABS_FLOOR_CREDITS`, `ELEVENLABS_TTS_FLOOR_CREDITS` | Optional. After the reserve time, STT spends down to 200 credits, TTS only to 1000. |
| `ELEVENLABS_START_CREDITS` | Optional. Plan credits for the local balance estimate (default 10000). |
| `TTS_CACHE_DIR` | Optional. TTS audio cache (default `.cache/tts`, i.e. `/app/.cache/tts` in Docker, a named volume). |
| `TTS_PREWARM_SECRET` | Optional. Bearer secret for `POST /api/speech/prewarm`; the route is 404 without it. |
| `TTS_TOKEN_SECRET` | Optional. HMAC secret for TTS tokens; defaults to one derived from the Pro cookie secret. |
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
- `GET /api/health` checks Anthropic and Stripe; 200 when both are ok, else 503. Also reports `elevenlabs`
  (enabled, remaining credits, today's usage); it never affects the status.
- `GET /api/speech/config` → `{ stt, tts }`, each `"elevenlabs"` or `"browser"`.
- `POST /api/speech/stt` (multipart `audio` + `durationMs`) → `{ text }` or `{ code: "unavailable" | "budget" |
  "too_long" | "failed" }`. Max 1.5 MB / 47 s.
- `POST /api/speech/tts` `{ text, token? }` → `audio/mpeg`, or `{ code }`. Only texts the server vouches for.
- `POST /api/speech/prewarm` (Bearer `TTS_PREWARM_SECRET`) pre-generates the jury's audio; see below.
- `/api/drill1/*`, `/api/drill2/*` drill endpoints.

## Guest, Pro and limits

- Guest: an httpOnly `guest_id` cookie (UUID), set by `getOrCreateGuestId()` in `lib/guest.ts`.
- Pro: an httpOnly cookie `ots_pro` = `<guestId>.<expiresAtMs>.<HMAC-SHA256>`. It is set only by
  `/api/pro/claim`, after the server retrieves the Checkout Session from Stripe and checks `status=complete`,
  `payment_status=paid` and `metadata.guestId` equal to the guest cookie. A query parameter alone never grants
  Pro. `isProRequest()` in `lib/pro.ts` verifies it. Pro is tied to the browser that paid.
- Limits (`lib/limits.ts`, in memory, reset on restart): free guests get 3 drill-1 starts per UTC day and one
  drill-2 try; AI calls are capped per guest (60/h), per IP (1500/h) and globally (3000/h).

## Speech (ElevenLabs, with browser fallback)

- **STT.** Push-to-talk runs Web Speech exactly as before (live interim text) and, when ElevenLabs is on,
  records the same audio with MediaRecorder (32 kbps Opus/AAC). On stop the audio goes to `/api/speech/stt`
  ("Transcribing…" while it works); its text wins and stays editable. Any error or a 15 s timeout silently uses
  the Web Speech text; both empty is the usual "we didn't hear anything". Where Web Speech is missing (Firefox,
  some iOS) but recording works, voice now works through the server alone.
- **TTS.** Only texts the server can vouch for: bank questions and drill 2 opening lines as they are; drill 2
  replies and rehearse questions with an HMAC token the server sends next to them. Audio is cached by
  `sha256(voice, model, format, text)` on disk (`TTS_CACHE_DIR`) plus a small in-memory LRU; a hit costs no
  credits and no budget. The client plays it in one audio element primed inside the tap (iOS), and falls back to
  `speechSynthesis` on any failure or when the audio isn't ready in 2.5 s. "Slower" plays at 0.85×.
- **Budget** (`lib/speech-budget.ts`, `lib/speech/credits.ts`). Daily UTC caps (TTS characters, STT seconds), kept
  in memory and in `speech-budget.json` next to the cache, with the all-time credits spent. Credits: Flash TTS
  0.5 credit/character, Scribe STT 330 credits/minute. The balance is the lower of the live one
  (`GET /v1/user/subscription`, cached 5 min) and `ELEVENLABS_START_CREDITS` minus the logged spend. Before
  `ELEVENLABS_RESERVE_UNTIL` nothing spends below `ELEVENLABS_RESERVE_CREDITS`; after it STT spends down to the
  floor, TTS stops 1000 credits earlier. Over any limit the provider is "unavailable" and the client falls back
  silently. Each call is logged (kind, amount, day total, credits used), never the key or a full text.
- **Prewarm.** `scripts/prewarm-tts.sh <base-url>` (env `TTS_PREWARM_SECRET`) runs a dry run first (prints the
  texts and the character total), then generates what isn't cached: the first 5 drill-1 questions a fresh guest
  gets (a fixed order, `JURY_ORDER`) and drill 2's first scenario (opening line, reveal lines, the confirm
  prompt). It refuses to run past 3,000 characters.

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

Compose project `on-the-spot`, container `on-the-spot-app`. The named volume `on-the-spot-speech-cache` at
`/app/.cache` keeps the TTS audio and the speech budget across redeploys. `scripts/deploy.sh` ships `origin/main` to
`/home/ubuntu/on-the-spot` on the server and rebuilds the container there.
