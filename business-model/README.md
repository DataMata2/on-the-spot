# On the Spot: business research and financial model

**Current offer: $12/month or $79/year. Daily free practice. Same product and pricing as the submitted pitch.**

On the Spot helps immigrant professionals rehearse an unexpected question in English at work. Our hypothesis: convenient short practice, specific feedback and preparation for a real meeting can earn a recurring subscription.

| Read | What you will find |
|---|---|
| **[Full research and business model](RESEARCH.md)** | Customer, competitors, pricing, free-user costs, acquisition, profit scenarios and growth plan |
| [How to read the pitch numbers](DECK-NOTES.md) | Definitions behind the deck's ~$55 LTV, ~90% margin and $100M ambition |
| [Sources and evidence](SOURCES.md) | Primary references, verified values and assumptions |
| [Calculation results](results.json) · [Reproduce the model](calculate.py) | Every cost line at 500, 2,000 and 10,000 active payers |
| **[Download business-model PDF](../docs/On-the-Spot-Business-Research.pdf)** | Full research, pitch explanations and sources in one document |
| [Submitted pitch PDF](../docs/pitch/On-the-Spot-Esep.pdf) | Original ten-slide deck, unchanged |

At **10,000 active payers**, the current-price model produces about **$72,036 monthly revenue / $864,427 annual revenue run-rate**. Operating profit is **$3,234/month at an assumed $19.25 cash acquisition cost**, or **$11,014/month at a $10 acquisition target**. Free users, replacement acquisition, support and team compensation are included, before corporate tax and additional growth.

**These are scenarios, not sales results or a first-year forecast.** Key assumptions: $0.40 AI cost per paid month, five active free users per payer, five Cold drills per active free user per month, and 5% conversion of newly activated free entrants. Actual usage, retention, conversion and acquisition cost need a paid pilot. Stripe is in test mode; initial feedback is qualitative.

The deck's contribution estimates are not company net profit. This appendix adds the operating-cost view and explains the differences in [DECK-NOTES.md](DECK-NOTES.md).

## Reproduce

```bash
python3 business-model/calculate.py --check  # validate arithmetic and committed results
python3 business-model/calculate.py          # regenerate results.json after editing assumptions
```

No API keys, paid calls or third-party Python packages are needed. Prose tables do not update automatically when assumptions change.

[Pitch calculation notes](pitch-model-notes.md) and [original model.csv](model.csv) preserve the earlier arithmetic behind the slides. They are historical inputs; use the full research and reproducible model for operating-profit decisions.
