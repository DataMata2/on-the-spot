# Sources, definitions and evidence

Checked 15 November 2026. A verified source input does not validate a product-specific forecast. The [model](RESEARCH.md) separates public measurements, calculations, estimates and observed product state.

## Market and scale

| Primary source | Verified input | Interpretation |
|---|---|---|
| [BLS foreign-born labour-force table, 2025](https://www.bls.gov/news.release/forbrn.t01.htm) | Ages 25–34: 6.128M; ages 35–44: 8.538M | Sum 14.666M includes unemployed people. Employed alone is 14.051M. Ages 25–44 is not exactly 25–45. |
| [BLS release, education](https://www.bls.gov/news.release/forbrn.nr0.htm) | 43.2% of foreign-born labour force aged 25+ have BA or higher | Applying it to ages 25–44 yields 6.336M, an approximate cross-age demographic proxy. |
| [BLS occupations, 2025](https://www.bls.gov/news.release/forbrn.t04.htm) | 31.321M foreign-born employed × 36.8%, plus 132.172M native-born × 45.2% | Derived professional/management employment ≈71.27M, all ages. The 2025 averages use eleven months, excluding October. |
| [Ruscio et al., 2008, Table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC2262178/) | NCS-R, n=9,282, fielded 2001–2003: 19.5% lifetime meeting/class speaking fear | 71.27M × 19.5% ≈13.90M is our extrapolation, not observed current demand. |
| [Duolingo Q3 2026 shareholder letter, SEC](https://www.sec.gov/Archives/edgar/data/1562088/000162828026069474/q3fy26duolingo9-30x26share.htm) | 13.1M period-end paid subscribers; $269.985M quarterly subscription revenue | Global comparator. Annualizing a quarter per ending subscriber is not a measured customer LTV or On the Spot forecast. |

## Subscription benchmarks

[RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps/) contains the following **global Education** chart values:

| Chart | Input |
|---|---:|
| First three monthly renewals by category: first | 56.24% |
| Retained subscribers after one year by plan duration: monthly median | 6.33% |
| First three annual renewals by category: first | 23.66% |
| Plan mix by category: yearly / monthly | 58.86% / 29.02% |
| Refund rate by category: median | 4.31% |
| Median Education price: monthly / yearly | $9.99 / $44.99 |

Exact chart values were inspected in the report's [public page data](https://www.revenuecat.com/page-data/state-of-subscription-apps/page-data.json). A [compact numeric extract](evidence/revenuecat-education.json) records relevant chart names and values. The report covers iOS, Android and web; this category aggregate is not our own customer cohort or a US workplace-English segment. Extrapolated later retention and stable future annual renewal remain assumptions. The 23.66% first annual renewal is distinct from the report's 23.53% retained-after-year metric.

## Provider costs

| Primary source | Checked rate | Model use |
|---|---|---|
| [Stripe Payments](https://stripe.com/pricing) | US standard domestic cards: 2.9% + $0.30 | Merchant-country assumption. International cards and currency conversion can add fees. Original processing fees are not returned after refunds. |
| [Stripe Billing](https://stripe.com/billing/pricing) | Pay-as-you-go: 0.7% of Billing volume | Combined assumed rate: 3.6% + $0.30 per subscription charge. |
| [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) | Sonnet 5.5: $2/M input tokens, $10/M output tokens | Token counts and retry rates are estimates. |
| [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) | Scribe v3 $0.20/hour; Flash/Turbo $0.04/1,000 characters | The team's speech duration, dynamic text and cache usage are estimates. |

Typical paid AI $0.40/month comes from the team's twelve-session token/audio scenario in [pitch notes](pitch-model-notes.md#cost-per-active-pro-user-per-month). The $1.50 case is a heavier-use scenario, not a guaranteed maximum. Free Cold $0.025, Clarify $0.08, support, hosting and buffers are explicit planning assumptions. Fixed vendor plan minima or utilisation inefficiency may require updating overhead.

## Competitors and acquisition

- [DemoTime](https://demotime.app/): Plus $39.99/month, 150 voice minutes; workplace scenarios, follow-ups and feedback overlap with the problem we address.
- [Yoodli](https://yoodli.ai/pricing): Pro $8/month billed annually ($96/year), up to ten roleplays/week. Different packages should not be treated as identical services.
- The pitch's ad-CPC and sponsored-content ranges are **third-party estimates retained in the historical notes**, not a verified channel funnel. They do not establish a cash CAC or conversion rate for our segment.
- Cash CAC $19.25, $15 and $10; 5% activated-free conversion; free MAU ratio, utilisation, payroll and support load are model assumptions. No source is claimed to prove them.

## Product and customer evidence

The [current code catalogue](../lib/plans.ts) and [free policy](../lib/limits-core.ts) support the offer. The [README](../README.md) describes the MVP and known limitations. The submitted [pitch](../docs/pitch/On-the-Spot-Esep.pdf) supplies the team-reported tester statements and selection rubric. Those statements are not purchases, a representative survey or a causal outcome study.

The broader 62-niche/111-pain selection work is reported in the deck. This financial companion does not independently rescore that ranking or claim an audited full-market census.
