# On the Spot: a path to a sustainable subscription business

Team Esep · 15 November 2026 · **Current offer: $12/month or $79/year**

[Overview](README.md) · [Pitch PDF](../docs/pitch/On-the-Spot-Esep.pdf) · [Sources](SOURCES.md) · [Calculations](results.json)

## 1. Customer, problem and value

On the Spot serves professionals who know their work but freeze when a question arrives unexpectedly in English. The initial segment is foreign-born professionals working in the US, approximately ages 25–44 in the demographic data, with this specific communication difficulty. Being an immigrant alone does not imply a need for English coaching.

The product provides a prepared sequence: choose a role, hear a work question, answer by voice or text, see feedback on the answer's structure, then practise again. Clarify trains questions that turn a vague request into a clear task. Rehearse supports preparation for a real meeting. The paid-value hypothesis is convenient and relevant preparation, with feedback the person can act on immediately.

Short digital sessions can have low variable delivery costs. Annual subscriptions help cash collection. Focused communities and purchase-based partnerships may avoid expensive broad advertising. These create a path to profitability **if paid conversion, repeat use, acquisition costs and free usage support the economics below**.

## 2. Current product and evidence

| Item | Status |
|---|---|
| Role-based Cold drill, feedback, retry, Clarify, progress and Rehearse | Implemented MVP; see the [jury path](../README.md#how-it-works-the-jury-path-about-2-minutes) |
| $12 monthly / $79 yearly | Current catalogue in [lib/plans.ts](../lib/plans.ts) |
| Three free Cold starts per UTC day; one free Clarify attempt | Current policy in [lib/limits-core.ts](../lib/limits-core.ts); prototype counters have limitations |
| Unlimited Pro | Current offer; this model does not impose a new 30-session commercial cap |
| Checkout | Stripe sandbox; test charges are not revenue |
| Feedback | Two team-recruited US testers in the pitch; one tried the product on a phone, one reviewed it |
| Price signal | One review called $12 affordable; this is an opinion, not a purchase |
| Paid cohort, observed CAC, retention or profit | Not yet established in the supplied evidence |

These early reviews support another experiment. They are a small convenience sample, not proof of broad demand. The next pilot should directly recruit the office-meeting persona as well as test adjacent customer-facing occupations.

## 3. Market and competition

The [BLS 2025 table](https://www.bls.gov/news.release/forbrn.t01.htm) counts **14.666 million foreign-born people aged 25–44 in the civilian labour force**, including unemployed people. Applying the **43.2% bachelor's-or-higher share for the foreign-born labour force aged 25+** gives the deck's rough **6.3 million demographic proxy**. The age groups differ. This is not a count of people with the problem or willingness to pay. [BLS education share](https://www.bls.gov/news.release/forbrn.nr0.htm)

We start with a reachable customer profile and paid-pilot funnel, rather than assuming a percentage of that population buys.

| Alternative | Public offer checked 15 Nov 2026 | Positioning implication |
|---|---|---|
| [DemoTime Plus](https://demotime.app/) | $39.99/month, 150 voice minutes | Workplace roleplay and feedback already exist. Our $12 entry price is lower; quality needs comparison. |
| [Yoodli Pro](https://yoodli.ai/pricing) | $8/month billed annually: $96/year, up to ten roleplays/week | Our $79 annual price is lower. Features and allowances differ. |
| A general-purpose chat assistant | A user can construct practice themselves | We must earn repeat use through a prepared task and useful feedback; this is not an exclusive AI capability. |

Our present proposition is a focused, accessible practice flow that can be tried immediately. Better task-specific feedback, evidence of improved answers and distribution relationships could strengthen it over time. They are development goals, not a proven competitive barrier.

## 4. Prices and the pitch's financial definitions

The annual plan is **$79 upfront**, equivalent to $6.58 per service month: a 45.1% discount against twelve $12 payments. Annual revenue is recognized over twelve service months. Receiving cash upfront does not turn it all into profit.

The pitch's **~90% margin** is the amount left after Stripe and estimated AI/speech at typical use. It excludes refunds, free users, support, acquisition and company overhead. The **~$55 LTV / ~$42 with support** is an earlier partial contribution estimate, not net lifetime profit. It uses different observation horizons for monthly and annual plans.

The operating model below applies a consistent cohort convention and subtracts all named operating expenses. It applies refunds to revenue without refunding already-incurred AI or processing costs. [Pitch-number reconciliation](DECK-NOTES.md)

## 5. Inputs: benchmarks versus assumptions

RevenueCat's **global Education-category** chart values are: first monthly renewal **56.24%**, monthly retention after one year **6.33%**, first annual renewal **23.66%**, refunds **4.31%**, yearly/monthly subscriptions sold **58.86%/29.02%**. We renormalize the two plan shares. These are multi-platform category proxies, not On the Spot's US workplace-English cohorts. [Report](https://www.revenuecat.com/state-of-subscription-apps/) · [Exact chart extract](evidence/revenuecat-education.json)

| Operating assumption | Value | Required measurement |
|---|---:|---|
| Paid AI + speech / paid month | $0.40 typical; $1.50 sensitivity | Provider cost by drill, retries and speech |
| Active free users / active payer | 5 | Returning and newly active free users |
| Cold drills / active free user / month | 5 | Observed average, **not a new limit** |
| Cost / free Cold drill | $0.025 | Complete drill, feedback/retry and speech |
| Free Clarify | $0.08 once per new activated free user | Budget every entrant using their one free attempt |
| Free infrastructure + human help | $0.03 / active free month | $0.01 infrastructure + $0.02 expected help |
| Free expense buffer | 20% | Usage, retries and repeat-account uncertainty |
| New activated free → paid | 5% | New-person conversion, not ad clicks or all free MAU |
| Paid support | 4 minutes/payer/month at $20/hour | Fully loaded contractor-time assumption |
| Founder support capacity | 20 hours/month already in salaries | Only excess paid support is contracted |
| Paid variable infrastructure | $0.10/payer/month | Hosting/storage bills |
| Cash acquisition cost (CAC) | $19.25 scenario; $15 comparison; $10 target | Attributed cash per new buyer, payroll separate |

The $0.40 AI estimate follows the team's twelve-session usage scenario: eight Cold drills, three Clarify and one Rehearse. Tokens, speech duration and caching are estimates. Vendor unit rates were checked, but **$0.40 is not an observed invoice result and $1.50 is not a maximum for unlimited Pro**. [Provider inputs](SOURCES.md#provider-costs)

Activation means first successful feedback after an answer. Returning free users stay in free MAU; eventual buyers' free-phase usage is included. No second lifetime free-trial allowance is added to this monthly free expense.

| Monthly staffing plan | 500 payers | 2,000 payers | 10,000 payers |
|---|---:|---:|---:|
| Founders | $2,000 | $4,000 | $6,000 |
| Other development/operations staff, excluding support | $0 | $1,500 | $10,000 |
| Fixed hosting, tools, administration | $250 | $750 | $1,500 |

These are hypothetical capacity plans, not verified staffing sufficiency or automatic hiring thresholds. Founder acquisition work is in payroll and is not charged again inside cash CAC. Referral incentives are recorded once, as a discount or marketing expense.

## 6. Revenue and operating profit

**USD/month; mature, constant active payer base.** Acquisition replaces churn. Initial base-building and additional growth are separate. An annual subscriber counts while their paid service period remains active even if they do not practise that month.

| Active payers | Revenue before refunds | Profit: $19.25 cash CAC | Profit: $15 cash CAC | Profit: $10 target cash CAC |
|---|---:|---:|---:|---:|
| 500 | $3,602 | -$833 | -$655 | -$444 |
| 2,000 | $14,407 | -$1,783 | -$1,068 | -$227 |
| 10,000 | $72,036 | **$3,234** | **$6,809** | **$11,014** |

**Included:** refunds, Stripe, paid AI/speech, free users, replacement acquisition, external support, infrastructure, founders and other staff. **Excluded from these profit figures:** corporate tax and additional growth spend. No actual tax rate is asserted; these are not after-tax earnings.

The $15 comparison is cash spending in addition to payroll. The pitch's community estimate included team time, so the two $15 figures are different accounting definitions. The $10 cash-CAC target does not follow automatically from the pitch: it must be demonstrated by acquisition tests.

### A transparent 10,000-payer example at the $10 target

| Item | USD/month, rounded |
|---|---:|
| Revenue before refunds | $72,036 |
| Refund provision | -$3,105 |
| Stripe Payments + Billing | -$3,158 |
| Paid AI and speech | -$4,000 |
| Free users, including buffer | -$10,915 |
| Cash acquisition to replace churn | -$8,411 |
| External paid-user support | -$12,933 |
| Founders + other staff | -$16,000 |
| Paid variable infrastructure + fixed overhead | -$2,500 |
| **Operating profit before tax and additional growth** | **$11,014** |

This scenario serves **50,000 active free users**. Maintaining the base requires about **841 new buyers/month** and **16,821 new activated free entrants/month** at 5% conversion. Channel capacity at that cost is unproven. [Exact values](results.json) avoid dollar differences from rounding.

## 7. Acquisition and self-funded development

We keep the deck's priority: professional communities, career centres, purchase-based creator partnerships and referrals. Their cost and reach are experiments; no signed pipeline is assumed.

| Channel | First test | Expansion rule |
|---|---|---|
| Communities / career programmes | Demonstrate one relevant task; attribute trials and genuine purchases | Record cash and team time separately; repeat only if economics and reach hold |
| Creators / affiliates | Capped purchase-based agreement, paid after the refund window | Add free usage and staff cost to the bounty; avoid large upfront sponsorships |
| Referrals | Capped reward after a real purchase | Count incentive once and test whether buyers are incremental |
| Meta | Small, capped advertising test | Measure actual click-to-paid conversion; an education CPC benchmark is insufficient |
| Search / LinkedIn | Deferred until observed contribution supports testing | Deck ranges are screening scenarios, not universal market prices |

### Milestones

1. **First 30 real payers.** Before real sales, finish subscription lifecycle and purchase recovery. Measure purchase, refund, repeat use, actual AI cost and support. Thirty payers are an exploratory milestone, not proof of a pricing A/B result; include non-buyers in conversion denominators.
2. **Repeatable cohorts.** Observe monthly renewal and channel economics before expanding spend. Annual renewal requires the actual renewal date. Stop or revise channels whose cost leaves no room for operations.
3. **Sustainable operations.** Match staffing and marketing to evidence. The selected salaries leave small-scale cases loss-making; founder capital must cover initial cash gaps. No grant or investor funding is assumed secured.
4. **10,000 active payers.** This retains the pitch's milestone and gives approximately $0.86M annual revenue run-rate. It is not a validated or funded first-year forecast. Growth beyond a stable base requires additional acquisition spending.
5. **Broader work situations and distribution.** Test interviews, leadership presentations, client calls and employer programmes after the initial use case works. These are future hypotheses, not current contracts or revenue.

Annual prepayment helps liquidity but comes with future service obligations. This appendix does not invent a launch funding requirement: it needs a monthly ramp, free-user retention, salaries and payment timing. The $7–10k from a different price proposal is not part of this current-offer calculation.

## 8. Growth potential and $100M

The retention convention implies 88.55% annual plans among active payers and **$86.44 annual revenue per active payer**:

| Scale | Arithmetic before refunds |
|---|---:|
| 10,000 active payers | $864,427 annual revenue run-rate |
| $100M annual revenue run-rate | About 1.16 million active payers |
| Replacement buyers at that scale | About 1.17 million per year under the same retention assumptions |

The rounded $86 / $0.86M / 1.16M figures match the deck. The replacement figure updates its older 1.26M estimate to a consistent lifetime convention. This is ambition and arithmetic, not demonstrated obtainable market share.

[Duolingo's Q3 2026 filing](https://www.sec.gov/Archives/edgar/data/1562088/000162828026069474/q3fy26duolingo9-30x26share.htm) reports 13.1 million paid subscribers. That demonstrates payment at global language-learning scale, not On the Spot's ability to capture a similar share.

The deck's broader **13.9M** proxy applies a 19.5% lifetime meeting/class speaking-fear estimate from a 2001–2003 adult survey to roughly 71.3M people employed in professional/management occupations in 2025. It is an exploratory extrapolation, not a current buyer survey or an English-specific market. [Original study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2262178/) · [BLS occupations](https://www.bls.gov/news.release/forbrn.t04.htm). No clinical treatment claim is made.

## 9. What can change the result

At 10,000 payers and $10 cash CAC, paid AI rising from $0.40 to $1.50 uses **another $11,000/month**, leaving about **$14** operating profit. Each extra average Cold drill per active free user costs **$1,500/month** across 50,000 free users, including the buffer. Twelve free Cold drills instead of five leave about **$514** at the same $10 cash CAC. Daily free and unlimited Pro therefore need measured utilisation and reliable provider budgets.

At base usage, the zero-profit cash-CAC threshold is about **$23.10 at 10,000 payers**, or **$8.65 at 2,000** with the named staffing plans. It leaves no extra growth or tax reserve and is not a target. At 500, even zero cash CAC slightly fails to cover the selected team and free use.

Other limits: retention, plan mix and refunds may differ from benchmarks; merchant-country fees, international cards, disputes, tax and settlement timing can change cash needs. Staff capacity is unverified. There is no debt or major capital expenditure in this model. Public vendor prices are reference inputs, not an invoice or contract.

## 10. Reproduce the calculation

We model initial monthly payment as `S0=1`, first renewal as `S1=0.5624`, and one-year survival as `S12=0.0633` after twelve renewals:

```text
q = (S12 / S1)^(1/11)
monthly paid lifetime = 1 + S1 / (1 - q)
annual paid lifetime = 12 / (1 - annual renewal)
new annual share = 58.86 / (58.86 + 29.02)
weighted lifetime = annual share × annual lifetime + monthly share × monthly lifetime
replacement buyers/month = active payers / weighted lifetime

free MAU = active payers × 5
new free entrants = replacement buyers / 5%
free expense = [free MAU × (5 × $0.025 + $0.01 + $0.02)
                + new free entrants × $0.08] × 1.20

profit = revenue - refunds - fees - paid AI - free expense
         - replacement acquisition - external support - infrastructure
         - founders - other staff - fixed costs
```

Holding later monthly survival and annual renewal constant indefinitely is an assumption, not a measured lifetime. Refunds reduce revenue while incurred costs remain. Founder labour is not deducted twice.

Run [calculate.py](calculate.py), inspect [results.json](results.json), and consult [sources](SOURCES.md) and [pitch notes](DECK-NOTES.md).
