# On the Spot: unit-economics model

Version 1, 2026-11-15. The rebuildable sheet is [`model.csv`](model.csv) (every input with its source, every derived
figure with its formula). The one-page picture is [`../docs/business-model.svg`](../docs/business-model.svg).

**How to read the marks.** Every input is **[V]** (opened on 2026-11-15 on its primary page, URL given), **[V-3P]**
(opened that day, but a third-party estimate, not the platform's own data), **[S]** (search snippet or an earlier
note, not re-opened) or **ASSUMPTION** (ours, labelled). **[calc]** = arithmetic from those inputs. Live prices come
from the code (`lib/plans.ts`) and the live site, https://speak.incode.kz.

**We have no real payers yet.** Retention, conversion and plan mix below are category benchmarks; every CAC is a
benchmark or an assumption. Channels and targets are **Planned**.

**One-line verdict.** LTV ≈ **$55 per payer** (≈ $42 if support is counted). Meta ads to the niche, partner
communities, creator affiliates and in-product referral can pay that back; LinkedIn, Google search and flat-fee
YouTube sponsorships cannot. $100M ARR needs ≈ **1.16M payers ≈ 18% of the 6.3M college-educated foreign-born
workers aged 25–44**. That is not credible from the wedge alone. It needs the broader "speak up at work" group
(section 7: ≈ 13.9M US professionals). The wedge supports a profitable niche, not $100M on its own.

---

## 1. Price and price anchors

| # | Item | Value | Mark | Source |
|---|---|---|---|---|
| P1 | On the Spot Pro, monthly | **$12/mo** (`amountCents: 1200`, `interval: "month"`) | product (live) | `lib/plans.ts`; https://speak.incode.kz |
| P2 | On the Spot Pro, yearly | **$79/yr** (`amountCents: 7900`) = $6.58/mo, 45% below 12 × $12 | product (live) | `lib/plans.ts`, `yearlySavingsPercent()` |
| P3 | Free tier | 3 drill-1 starts per UTC day; one free try of drill 2 | product | `lib/limits-core.ts` |
| P4 | What Pro unlocks | "unlimited drills, Clarify drill, rehearse your real meeting" | product | `lib/plans.ts` |
| B1 | RevenueCat median app price, Education | **$9.99/mo, $44.99/yr** (global) | [V] chart data | RevenueCat State of Subscription Apps 2026, chart "Median price (mid value) per plan duration by category", https://www.revenuecat.com/state-of-subscription-apps/ |
| B2 | RevenueCat median app price, North America | $9.99/mo, $39.99/yr | [V] chart data | same, "Median price per plan duration by geography" |

**Competitor anchors:**

| Product | Price (US) | Focus | Mark | URL |
|---|---|---|---|---|
| Spleek | **$14.99/month**, "Cancel anytime" | professionals who work in English: pitching, client calls, interviews | [V] | https://www.tryspleek.com/ |
| Yoodli | Free (5 lifetime roleplays); Pro **$8/mo billed annually** (up to 10 roleplays a week); Advanced $20/mo billed annually | general communication coach, not ESL | [V] | https://yoodli.ai/pricing |
| ELSA Speak | App Store: "Monthly – $19.99", "1 Year Elsa Premium – $99.99", other 1-year tiers $71.00 / $109.99 / $129.99, 3 months $39.99–$52.00 | pronunciation first | [V] | https://apps.apple.com/us/app/elsa-speak-english-learning/id1083804886 |
| Speeko | App Store: monthly **$24.99**; annual $79.99 and $99.99 | public speaking, roleplay | [V] | https://apps.apple.com/us/app/-/id1071468459 |
| Orai | App Store: monthly **$12.99**, yearly $49.99, lifetime $99.99 | public-speaking drills | [V] | https://apps.apple.com/us/app/-/id1203178170 |
| BoldVoice | App Store: subscription options "$14.99 to $199.99" | accent / pronunciation | [V] range only; "~$150/yr" is [S] | https://apps.apple.com/us/app/wellocution/id1567841142 |
| Poised | none. Homepage: "Poised is shutting down on 10/8/2026" | live-meeting coach | [V] | https://poised.com |

**Price story [calc]:** $12/mo sits between Orai $12.99 and Spleek $14.99 and below ELSA $19.99 and Speeko $24.99;
$79/yr equals Speeko's lower annual tier and is under ELSA's $99.99. Yoodli Pro ($8/mo billed yearly = $96/yr) is the
cheaper general coach. "Priced in the middle of the category", not "cheapest".

## 2. Retention and conversion benchmarks (RevenueCat SOSA 2026)

RevenueCat has an **Education** category (no separate "language" category). The base is **Education (global)**;
**North America, all apps** is the cross-check. All from the chart data served by
https://www.revenuecat.com/state-of-subscription-apps/. Medians unless stated. **[V]** for all rows.

| # | Metric | Education (global) | NA, all apps | Chart |
|---|---|---|---|---|
| R1 | 1st monthly renewal | **56.24%** | 54.91% | "First 3 monthly subscription renewals by category" / "Median subscription renewal rates by geography" |
| R2 | Monthly plan, retained after 12 months | **6.33%** (top quartile 11.12%) | 8.17% (all categories, global; not an NA cut) | "Retained subscribers after 1 year by plan duration" |
| R3 | 1st annual renewal | **23.66%** (Y1 retention 23.53%) | 25.8% | "First 3 annual subscription renewals by category"; geography chart |
| R4 | Plan mix sold: yearly / monthly / weekly / other | **58.86% / 29.02% / 6.84% / 5.28%** | 39.66% / 36.17% / 23.04% | "Plan mix (subscriptions sold) by category" / "by geography" |
| R5 | Refund rate | **4.31%** | 3.45% | "Refund rate by app category" / "by geography" |
| R6 | Day-35 download → paid | **2.15%** | 2.83% | "Day 35 download-to-paid by category" / "by geography" |
| R7 | Trial → paid | 36.11% | 34.19% | "Trial-to-paid by category" / "by geography" |
| R8 | RLTV per payer after 1 year (cross-check) | **$27.28** | $26.07 | "Realized lifetime value (RLTV) per payer after 1 year by category" / "by geography" |
| R9 | AI apps, retained after 12 months: monthly / annual | 6.14% / 21.1% (all AI apps) | — | "Retained subscribers after 12 months by AI vs. non-AI" |

**Caveat:** these are mobile app-store subscriptions; On the Spot is a web app billed by Stripe. They are directional
proxies until our own funnel data exists.

## 3. Costs per payer and gross margin

### Payment fees [V]
Stripe "2.9% + 30¢ per successful transaction for domestic cards" (https://stripe.com/pricing) + Billing "0.7% of
Billing volume" (https://stripe.com/billing/pricing).
[calc] **$12 → $0.73 per charge (6.1%); $79 → $3.14 per charge (4.0%).**

### AI and speech: what the code calls

| Step | Provider / model | Calls | Output cap | Code |
|---|---|---|---|---|
| Drill 1 feedback on one answer | Anthropic `claude-sonnet-5-5`, effort low, JSON schema | 1 per answer (first answer + retry = 2 per drill) | `max_tokens: 900` | `lib/ai.ts`; `app/api/drill1/feedback/route.ts` |
| Drill 1 role questions ("other" role only, cached per role text) | same | ≤ 1 per new role text | 1,600 | `lib/drill1/role-gen.ts`; `app/api/drill1/start/route.ts` |
| Drill 2 extractor (each question and the confirmation) | same | 1 per user turn; ≤ 12 turns + confirm | 800 | `lib/drill2/ai.ts`; `lib/drill2/sessions.ts` (`MAX_TURNS = 12`) |
| Drill 2 manager reply ("character") | same | 1 per question turn | 200 | `lib/drill2/ai.ts` |
| Rehearse my real meeting: question generation | same | 1 per agenda | 1,200 | `app/api/rehearse/questions/route.ts` |
| Speech-to-text | ElevenLabs `scribe_v3` (batch); browser Web Speech fallback = $0 | 1 per recorded answer, ≤ 47 s | — | `lib/speech/config.ts` |
| Text-to-speech | ElevenLabs `eleven_flash_v2_5`; disk cache, so the fixed question banks cost ~$0 after the first play; browser `speechSynthesis` fallback = $0 | only uncached dynamic text: drill 2 replies, rehearse/role questions; ≤ 600 chars | — | `lib/speech/config.ts`; `lib/speech/tts-cache.ts`; `lib/speech/tts-allow.ts` |

### Vendor prices [V]
- **Claude Sonnet 5.5: "$2 / MTok" input, "$10 / MTok" output**; cache hits $0.10/MTok; batch $1/$5.
  https://platform.claude.com/docs/en/about-claude/pricing
- **ElevenLabs Scribe v3: "$0.20 | Price per hour"** (= $0.0033/min). **Flash / Turbo TTS: "$0.04 | Price per 1K
  characters"**. Check: the plan tables match these unit prices (e.g. Pro $99/mo = 495 Scribe hours × $0.20 =
  2,475,000 Flash characters × $0.04/1K). https://elevenlabs.io/pricing/api
- The code constant `STT_CREDITS_PER_SECOND = 330/60` (`lib/speech/config.ts`) uses an older credit rate. It is only a
  budget guard, so it does not change the dollar cost; the vendor page is the source here.

### Cost per active Pro user per month

**ASSUMPTION box: usage and tokens**
- Base user: **12 sessions/month**: 8 × drill 1 (answer + retry = 2 feedback calls, 2 × 35 s audio), 3 × drill 2
  (4 questions + 1 confirmation = 5 extractor + 4 reply calls, 5 × 10 s audio, 4 replies × 150 chars of uncached TTS),
  1 × rehearse (1 generation + 5 answers with feedback, 5 × 35 s audio, 5 questions × 120 chars TTS).
- Heavy user: **the daily drill every day (30 sessions, 2.5× base)** with every call at its `max_tokens` cap.
- Input tokens per call, from the prompt sizes in the code (≈ 4 chars/token) plus ≈ 300 tokens of schema overhead:
  drill 1 feedback ≈ 1,250 (`FEEDBACK_SYSTEM` + schema = 2,903 chars in `lib/drill1/feedback.ts`, + question and a
  45 s transcript); drill 2 extractor ≈ 1,000; reply ≈ 350; rehearse ≈ 1,500. Typical output: 450 / 200 / 60 / 700.
- The server-side fallback beta (`lib/drill2/ai.ts`) may route to another model at another price; not modelled.
- Free-tier AI cost is not modelled (a free user at the 3/day drill-1 cap ≈ $1.6/mo).

| Line [calc] | Base (typical tokens) | Heavy (30 sessions, at caps) |
|---|---|---|
| Claude: drill 1 (16 feedback calls × $0.0070; at cap $0.0115) | $0.11 | $0.46 |
| Claude: drill 2 (3 × [5 × $0.0040 + 4 × $0.0013]; at cap $0.0100 / $0.0027) | $0.08 | $0.46 |
| Claude: rehearse ($0.010 + 5 × $0.0070; at cap $0.015 + 5 × $0.0115) | $0.05 | $0.18 |
| ElevenLabs STT (≈ 885 s ≈ 14.75 min × $0.0033) | $0.05 | $0.12 |
| ElevenLabs TTS (≈ 2,400 uncached chars × $0.04/1K) | $0.10 | $0.24 |
| **Total per active Pro user per month** | **≈ $0.40** | **≈ $1.46** |

The heavy case matches our earlier internal planning budget of **$1.50/month** for API costs. **The LTV below uses
$1.50 (conservative).**

**Gross margin per payment [calc]** (after Stripe and AI/speech, before support and hosting):
- At base usage ($0.40/mo): **monthly 90.6%, annual 89.9%**.
- At heavy usage ($1.50/mo): monthly 81.4%, annual 73.2% (a yearly payer who drills daily all year costs $18 of AI on $79).
- Support (not in gross margin), **ASSUMPTION**: 4 min per payer per month at $20/h = **$1.33/mo**. Shown separately below.

## 4. LTV per payer (12-month horizon for monthly; one renewal for annual; after fees, AI and refunds)

**Monthly plan ($12)**
- Net per paid month = 12 − 0.73 (Stripe) − 1.50 (AI/speech) = $9.77; × (1 − 4.31% refunds, R5) = **$9.35**.
- Paid months in year 1: month 1 = 1.0, month 2 = 56.24% (R1), geometric decay to 6.33% (R2) at month 12 →
  **3.61 paid months** (NA cross-check, 54.91% → 8.17%: 3.78).
- **Monthly LTV = 3.61 × 9.35 ≈ $33.7** (NA cross-check $35.6).

**Annual plan ($79)**
- Net per charge = 79 − 3.14 − 18.00 (12 × $1.50 AI, heavy-use estimate; ASSUMPTION: Pro has no cap, only an abuse
  guard of 60 AI calls/hour) = $57.86; × 0.9569 = **$55.36**.
- One renewal at 23.66% (R3). **Annual LTV = 55.36 × 1.2366 ≈ $68.5** (NA 25.8%: $70.3).

**Blended**
- Mix: Education plans sold (R4) renormalised to our two plans: **67% annual / 33% monthly** ([V] mix, applied as an ASSUMPTION).
- **Blended LTV = 0.67 × 68.5 + 0.33 × 33.7 ≈ $57.0.** NA cross-check (52/48 mix, NA retention, 3.45% refunds): **$53.7**.
- **Headline: LTV ≈ $55** (range $54–57).
- With support (4 min/mo at $20/h, ASSUMPTION): monthly $28.9, annual $48.7, **blended ≈ $42** (NA $41).
- At base AI usage ($0.40/mo) instead of $1.50: blended $69 (with support $54). AI use is the second-biggest lever after retention.
- Sanity check: RevenueCat Education RLTV after 1 year is $27.28 (R8, all plans, gross). Our first-year gross for a
  monthly payer is $12 × 3.61 = $43; for an annual payer $79. Ours is above the category median: plausible because our
  prices are above the Education median ($9.99 / $44.99, B1), but it is optimistic until we have data.
- AI-app check (R9): with AI-app 12-month retention (monthly 6.14%, annual 21.1%) the blended LTV is ≈ $56. No change.

**Payback [calc].** An annual payer repays CAC from the first charge when CAC is under ≈ **$40** (= $79 net of Stripe,
a year of heavy AI use and a year of support, after refunds). A monthly payer at a $35 CAC needs 3.7 paid months, about
the whole average life (3.61): monthly payers roughly break even before support (3.61 × $9.35 = $33.7) and lose money
after it; annual payers carry the margin.

## 5. CAC by channel, LTV/CAC (LTV $55) and decision (Planned)

CAC = cost per click ÷ (click → paid), unless stated.
**ASSUMPTION K1: click → paid 2% (base) / 4% (optimistic)**, anchored on RevenueCat Education day-35 download → paid
2.15% (R6). Every CAC below depends on it.

| Channel | Inputs | CAC | LTV/CAC | Decision |
|---|---|---|---|---|
| In-product referral ("give a friend a free month") | ASSUMPTION: cost = one forgone month ≈ $9.35 net | **≈ $9** | **≈ 5.9×** | **Yes.** No volume benchmark; upside |
| Communities, university career centres, immigrant professional groups (partner codes, workshops) | ASSUMPTION: $15 per payer (team time + a free month for the group). No partner signed; no benchmark found | **≈ $15** | **≈ 3.7×** | **Yes, first.** A hypothesis to test, not a channel with customers today |
| YouTube/TikTok creators in English-for-work, paid **per payer** (affiliate) | ASSUMPTION: $20 bounty (25% of $79) | **$20** | **2.75×** | **Yes**, on a per-payer deal only |
| Same creators, **flat-fee** sponsorship | Education integration CPM "$20-$40" per 1,000 views [V-3P, OutlierKit "planning estimates", updated 2026-09-13, https://outlierkit.com/resources/youtube-sponsorship-rates/]; ASSUMPTION view → visit 0.5–1%, visit → paid 2–4% | $50–400 | 0.14–1.1× | **No** flat fees until a per-payer test shows conversion |
| Meta (FB/IG) ads targeted at immigrant professionals | Education & Instruction traffic CPC **$0.70**, CTR 1.50% [V-3P, LocaliQ/WordStream, "Last Updated: September 23, 2026", https://localiq.com/blog/facebook-advertising-benchmarks/] ÷ 2% / 4% | **$35 / $18** | **1.6× / 3.1×** | **Test.** Break-even needs 1.3% click → paid. The benchmark is all education advertisers; narrow interest targeting will likely cost more per click |
| Google search, English-practice keywords | Volume-weighted CPC **$7.21** over 6 keywords, 5,650 US searches/mo: "business english" 1,300 @ $8.52; "english speaking practice" 1,900 @ $5.79; "business english course" 1,000 @ $12.71; "english speaking app" 880 @ $4.07; "how to improve english speaking" 480 @ $4.07; "english for work" 90 @ $4.59 [V-3P, seodata.dev "from the Google Ads API", e.g. https://www.seodata.dev/keyword/english-speaking-practice]. Cross-check: LocaliQ 2026 Education & Instruction search CPC **$4.81** [V-3P, https://localiq.com/blog/search-advertising-benchmarks/] | **$180–360** ($120–240 at $4.81) | **0.15–0.3×** (0.2–0.5×) | **No.** Break-even needs 13% click → paid |
| LinkedIn ads | US median CPC **$8.99**, CPM $62.67 [V-3P, ZenABM: 161,256 ads, 211 B2B companies, 29 countries, https://zenabm.com/blog/linkedin-ads-benchmarks-2026.md] | **$225–450** | **0.12–0.25×** | **No** |
| SEO ("how to answer questions in meetings", English for work) | "how to speak up in meetings" **50 searches/mo**, CPC $0.00 [V-3P seodata.dev]; "how to answer questions in meetings": no data on seodata.dev. ASSUMPTION: $1,000/mo content, 5% capture of the 5,700 searches/mo above, 2–4% → 6–11 payers/mo | **$88–175** | 0.3–0.6× | **Not yet.** The meeting-specific searches are tiny; SEO is a by-product of content, not a growth channel |

**In one line:** we don't buy search or LinkedIn clicks: $5–9 a click would cost $120–450 per payer against an LTV of
about $55. We plan to grow through immigrant-professional communities and career centres, English-for-work creators paid
per payer, and in-product referral, and we test Meta ads at about $0.70 a click.

## 6. Market and the path to $100M ARR

**User base [V]** (BLS, "Labor Force Characteristics of Foreign-born Workers — 2025", released May 19, 2026):
- Foreign-born civilian labour force 2025: **32,687k**; aged 25–34 **6,128k**, 35–44 **8,538k** → **14.67M aged 25–44** [calc].
  https://www.bls.gov/news.release/forbrn.t01.htm
- 25+ with a bachelor's or higher: "43.2 percent versus 45.5 percent" (foreign-born vs native-born). https://www.bls.gov/news.release/forbrn.nr0.htm
- **14.67M × 43.2% ≈ 6.3M college-educated foreign-born workers aged 25–44** [calc; the BA share is for 25+, so an order of magnitude].
- Employed foreign-born in "Management, professional, and related occupations": 36.8% of 31,321k ≈ **11.5M** (all ages). https://www.bls.gov/news.release/forbrn.t04.htm
- Pew: 53% of immigrants speak English proficiently (ACS 2023) [S, not re-opened].

**Payers needed [calc].**
- Active-payer mix: plans *sold* are 67/33 annual/monthly, but an annual payer stays ≈ 14.8 months (12 × 1.2366) and a
  monthly payer ≈ 3.6, so **≈ 89% of active payers are annual**.
- ARR per active payer = 0.89 × $79 + 0.11 × $144 ≈ **$86**.
- **$100M ÷ $86 ≈ 1.16M payers** (all-annual: $100M ÷ $79 ≈ 1.27M).
- **= 18% of the 6.3M** (20% all-annual); 10% of the 11.5M foreign-born professionals of all ages; 73% of the ≈ 1.6M
  college-educated immigrants who report less than "very well" English ([S] Migration Policy Institute).
- Churn: holding 1.16M payers needs ≈ **1.26M new payers a year** (annual stock 1.033M ÷ 1.2366 yr + monthly 0.128M × 12 ÷ 3.61).
  ≈ $25M a year of acquisition at a $20 blended CAC (ASSUMPTION).
- **Honest stretch note:** about 1 in 5 of the whole college-educated immigrant workforce aged 25–44 would have to pay.
  That is not a credible plan for the wedge alone. The wedge is a beachhead: **Planned** year-1 target **10k payers ≈
  $0.86M ARR** (10k × $86, an arithmetic target, not a forecast). $100M needs the broader group in section 7.

**Comparable with public numbers [V]:** Duolingo Q3 2026 shareholder letter (SEC 8-K): "Paid subscribers (period end)
11.5M 13.1M 14% YoY"; subscription revenue $269,985K in the quarter; FY2026 revenue guidance $1,221M; Duolingo is
sunsetting Max and moving "unlimited Video Call" (AI conversation practice) into Super.
https://www.sec.gov/Archives/edgar/data/0001562088/000162828026069474/q3fy26duolingo9-30x26share.htm
[calc] ≈ $82 of subscription revenue per paid subscriber per year (quarter × 4 ÷ 13.1M). **1.16M payers ≈ 9% of
Duolingo's paid base, at a similar revenue per payer.** Duolingo is general language learning for everyone, not a
workplace-speaking product; it only shows that people pay ≈ $80 a year for language practice at scale. No public revenue
or subscriber numbers were found for Spleek, Yoodli, ELSA, Speeko, Orai or BoldVoice (BoldVoice's App Store page says
"over 2 million" users, which is not payers).

## 7. Potential: **FUTURE, NOT BUILT**

From "meeting English for immigrant professionals" to a speaking-confidence coach for anyone who must speak up at work.
Nothing in this section exists in the product today.

- **Prevalence [V], peer-reviewed:** Ruscio et al., *Psychological Medicine* 2008, National Comorbidity Survey
  Replication (nationally representative, n = 9,282): "The most common lifetime social fears among those considered here
  are public speaking (21.2%) and speaking up in a meeting or class (19.5%)." https://pmc.ncbi.nlm.nih.gov/articles/PMC2262178/
  (abstract: https://pubmed.ncbi.nlm.nih.gov/17976249/). Survey fielded 2001–2003: old, but it is the national benchmark.
- **Government [V]:** NIMH: "An estimated 7.1% of U.S. adults had social anxiety disorder in the past year." (NCS-R).
  https://www.nimh.nih.gov/health/statistics/social-anxiety-disorder . This is a clinical disorder; the product is
  **not** a treatment for it and makes no medical claims.
- **Size [calc]:** US employed in management, professional and related occupations 2025 = 11.5M foreign-born + 59.7M
  native-born (45.2% of 132,172k) ≈ **71.3M** (BLS table 4, above). × 19.5% who report a fear of speaking up in a
  meeting ≈ **13.9M US professionals**. (All 163.5M employed × 19.5% ≈ 31.9M, a looser upper bound.) Applying a
  2001–03 adult prevalence to 2025 professionals is an ASSUMPTION.
- **Demand signal [V-3P]:** US monthly searches: "fear of public speaking" **4,400** ($4.71 CPC), "public speaking
  anxiety" **1,300** ($4.61) (seodata.dev, https://www.seodata.dev/keyword/fear-of-public-speaking).
- **What it means for $100M [calc]:** 1.16M payers = **≈ 8% of the 13.9M**, versus 18% of the wedge. Still a stretch,
  but a plausible order of magnitude. Competition in that broader space is crowded (Yoodli, Speeko, Orai; Poised has
  shut down).

## 8. Break-even, and our earlier internal model at the live prices

An earlier internal planning model assumed $19/mo for 12 capped sessions, 10% monthly churn, 10% trial → paid, $30 cash
CAC, API $1.50, support 4 min @ $20/h, infra $0.10. The live product is **$12/mo or $79/yr, unlimited Pro**, so:
- **Kept:** API $1.50 (= our heavy case), support $1.33, infra $0.10, refunds ~3–4%, the Stripe formula.
- **Replaced:** 10% monthly churn → RevenueCat Education (56.24% 1st renewal, 6.33% at 12 months). Its 12-month
  contribution ($104 at $19) becomes ≈ **$29 at $12** on the benchmark curve [calc: (12 − 0.36 − 0.73 − 1.50 − 1.33 − 0.10) × 3.61].
  The annual $79 plan, which it left out, adds the bulk of the value ($48.7 with support; section 4).
- **Break-even [calc], before acquisition spend, on Planned fixed costs ($250/mo fixed + $2,000/mo founders, planning
  placeholders):** contribution per active payer-month ≈ $3.70 (heavy AI) to $4.80 (base AI) at the 89/11 active mix →
  **≈ 470 active payers at base AI use** (inside the ≤ 500-payer cost tier: $250 fixed + $2,000 founders); at heavy AI
  use there is no break-even in that tier: the next tier is $7,750/mo (founders $4,000 + staff $3,000 + fixed $750),
  $7,750 ÷ $3.70 ≈ 2,100 payers, above that tier's 2,000 cap.
- Its $30 CAC and 10% trial conversion are unmeasured; not used.

## 9. Not verified / left out
- **Our own funnel**: zero real payers so far; every click → paid, capture share, bounty and partner CAC is an assumption.
- RevenueCat has no "language learning" category and no Education × North America cut; Education is global. Mobile, not web.
- Token counts per call are estimates from prompt sizes, not measured usage logs; the fallback model's price is not modelled.
- All ad benchmarks are third-party ([V-3P]); WordStream pages returned 403 (LocaliQ, the same publisher's partner,
  was used). No US benchmark specific to immigrant-professional targeting exists. No TikTok number was used.
- "How to answer questions in meetings": no keyword data available. Creator CPMs are a vendor's planning estimate.
- Could not open: speeko.co/pricing (404), boldvoice.com/pricing (404, App Store range used), Poised pricing (shut down).
  BoldVoice "~$150/yr" stays [S]. Pronounce, DemoTime, Speak, Praktika prices were not re-checked.
- The Ruscio 19.5% / 21.2% figures were read in the PMC full text; the PDF table itself was not opened.
- Pew 53% and MPI 74% were not re-opened.
