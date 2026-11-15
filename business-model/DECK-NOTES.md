# How this model connects to the submitted pitch

The [ten-slide pitch](../docs/pitch/On-the-Spot-Esep.pdf) is preserved unchanged. This companion uses its **current $12/month and $79/year offer**, initial audience, product and growth direction. It adds full operating expenses and makes the financial definitions explicit.

| Pitch item | How to read it alongside the full model |
|---|---|
| Slide 7: ~$55 LTV, ~$42 with support | Earlier partial contribution estimate. It excludes free users, acquisition and company overhead. It is not company net profit or a measured customer lifetime. |
| Slide 7: ~90% gross margin | Approximately the price remaining after Stripe and estimated AI/speech at typical usage. It excludes refunds, free users, support, acquisition and overhead. |
| Slide 7: 56% / 24% renewal | Rounded global Education benchmarks, explicitly not our own retention. The model uses the underlying 56.24% / 23.66% inputs. |
| Slide 7: annual CAC under ~$40 repaid from the first charge | A partial service-contribution threshold. At $1.50 AI/month, $79 leaves ~$37.25 after refund provision, Stripe, a year of AI, paid support and variable infrastructure, **before free users and fixed expenses**. It is not an all-cost CAC ceiling. |
| Slide 7: channel CAC / LTV ratios | Planned screening illustrations, not evidence that each channel covers all business expenses. Community labour and cash CAC must be distinguished. |
| Slide 8: ~$86 per active payer/year | Consistent: the current model gives $86.44 at its active plan mix. |
| Slide 8: 10,000 payers ≈ $0.86M annual revenue | Consistent arithmetic. The slide labels the first-year target as a target, not a forecast; the operating model does not assume it has been reached. |
| Slide 8: $100M ≈ 1.16M active payers | Consistent rounded arithmetic; demand, reach and funding at that scale are unproven. |
| Slide 8: 1.26M new payers/year to maintain that base | The older lifetime convention. The consistent model gives approximately **1.17M/year**. This is a method refinement, not measured churn. |
| Slides 5 and 9: 6.3M initial audience | Rough demographic proxy, not customers or people known to need the product. The underlying 14.67M counts labour-force participants, including unemployed people. |
| Slide 9: 13.9M broader audience | Extrapolation from an old general-adult lifetime-fear survey to 2025 professional employment. It is not observed purchase intent or a current English-learning market. |

## Why the full calculation differs from the earlier LTV shorthand

The pitch notes combined a truncated monthly-payer horizon with one possible annual renewal and applied the refund factor to net contribution. The reproducible model uses initial monthly payment `S0=1`, first renewal `S1`, a one-year survival anchor and a consistent continuation convention for both plans. Refunds reduce revenue; consumed AI and original fees remain expenses.

For comparison, under the consistent lifetime convention the current-price contribution **including full paid support and $0.10/month paid infrastructure**, but **before free users, CAC, fixed expenses and tax**, is about **$43.33 per new payer at $1.50 AI/month**, or **$56.40 at $0.40 AI/month**. These are not the same cost boundary as the deck's pre-support $55. The company-level profit table is the appropriate basis for profitability decisions.

The original [pitch calculation notes](pitch-model-notes.md) remain available for traceability. The submitted PDF contains no claim of 470-payer company break-even, 17% operating margin at 2,000 payers or a $7–10k launch requirement; those figures should not be attributed to this deck.

## What the jury can verify now

- The current product, price catalogue and sandbox purchase flow.
- The original pitch and its labelled tester statements, assumptions and future expansion.
- Sources, model inputs, expenses and calculation checks in this repository.

## What the paid pilot must establish

Actual purchases, repeat use, renewal, refunds, free-user intensity, provider bills, acquisition cost and support capacity. No table in this companion converts those hypotheses into existing traction.
