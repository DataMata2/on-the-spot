#!/usr/bin/env python3
"""Reproduce the current-offer financial scenarios using Python's standard library.

Run ``python3 calculate.py`` to write results.json beside this file.
Run ``python3 calculate.py --check`` to compare without writing any file.
Importing this module does not write files or execute the checks.
"""

import argparse
import json
import math
from pathlib import Path


INPUTS = {
    "monthly_price": 12.0,
    "annual_price": 79.0,
    "annual_new_share": 58.86 / (58.86 + 29.02),
    "monthly_first_renewal": 0.5624,
    "monthly_survival_12": 0.0633,
    "annual_renewal": 0.2366,
    "refund_rate": 0.0431,
    "stripe_rate": 0.036,
    "stripe_fixed": 0.30,
    "paid_ai_per_month": 0.40,
    "free_mau_per_payer": 5.0,
    "cold_sessions_per_free_mau": 5.0,
    "cold_cost": 0.025,
    "clarify_cost": 0.08,
    "free_infra_per_mau": 0.01,
    "free_help_per_mau": 0.02,
    "free_buffer_rate": 0.20,
    "new_free_to_paid": 0.05,
    "support_minutes_per_payer": 4.0,
    "support_hourly_cost": 20.0,
    "founder_support_hours": 20.0,
    "paid_infra_per_month": 0.10,
    "illustrative_tax_reserve": 0.20,
}

STAFFING = [
    {"payers": 500, "founder_payroll": 2000.0, "other_payroll": 0.0, "fixed_cost": 250.0},
    {"payers": 2000, "founder_payroll": 4000.0, "other_payroll": 1500.0, "fixed_cost": 750.0},
    {"payers": 10000, "founder_payroll": 6000.0, "other_payroll": 10000.0, "fixed_cost": 1500.0},
]

SCENARIOS = [
    {
        "id": "cash_cac_19_25",
        "label": "Current offer; cash CAC $19.25 assumption",
        "cash_cac": 19.25,
        "changes": {},
        "provenance": "Assumed acquisition mix from the prior planning model; not observed CAC.",
    },
    {
        "id": "cash_cac_15",
        "label": "Current offer; $15 cash acquisition budget",
        "cash_cac": 15.0,
        "changes": {},
        "provenance": "Deck-related planning sensitivity. Here $15 is entirely CASH spend; founder labour is separately in payroll. This is not the deck's measured or fully loaded CAC.",
    },
    {
        "id": "cash_cac_10_target",
        "label": "Current offer; community-first cash CAC $10 target",
        "cash_cac": 10.0,
        "changes": {},
        "provenance": "An acquisition target for a pilot, not a signed partner price or demonstrated scalable channel.",
    },
    {
        "id": "paid_ai_1_50",
        "label": "Higher paid AI usage: $1.50/month; cash CAC $19.25",
        "cash_cac": 19.25,
        "changes": {"paid_ai_per_month": 1.50},
        "provenance": "One-variable usage sensitivity, not an upper spending limit for unlimited Pro.",
    },
    {
        "id": "free_cold_12_per_month",
        "label": "More free use: 12 Cold sessions/free MAU/month; cash CAC $10",
        "cash_cac": 10.0,
        "changes": {"cold_sessions_per_free_mau": 12.0},
        "provenance": "One-variable sensitivity against the $10-CAC target; does not change the daily product allowance.",
    },
]


def retention(inputs):
    """Cohort convention: initial monthly payment S0=1; S12 after 12 renewals."""
    p = inputs
    q = (p["monthly_survival_12"] / p["monthly_first_renewal"]) ** (1.0 / 11.0)
    monthly_lifetime = 1.0 + p["monthly_first_renewal"] / (1.0 - q)
    annual_lifetime = 12.0 / (1.0 - p["annual_renewal"])
    lifetime = p["annual_new_share"] * annual_lifetime + (1.0 - p["annual_new_share"]) * monthly_lifetime
    active_annual_share = p["annual_new_share"] * annual_lifetime / lifetime
    return {
        "late_monthly_survival": q,
        "monthly_paid_lifetime_months": monthly_lifetime,
        "annual_paid_lifetime_months": annual_lifetime,
        "weighted_paid_lifetime_months": lifetime,
        "active_annual_share": active_annual_share,
        "monthly_replacement_rate": 1.0 / lifetime,
    }


def calculate_row(plan, cash_cac, inputs):
    p = inputs
    n = plan["payers"]
    r = retention(p)
    annual_active = n * r["active_annual_share"]
    monthly_active = n - annual_active
    replacements = n / r["weighted_paid_lifetime_months"]
    new_free = replacements / p["new_free_to_paid"]
    free_mau = n * p["free_mau_per_payer"]
    gross_revenue = annual_active * p["annual_price"] / 12.0 + monthly_active * p["monthly_price"]
    refunds = gross_revenue * p["refund_rate"]
    stripe = annual_active * (p["annual_price"] * p["stripe_rate"] + p["stripe_fixed"]) / 12.0
    stripe += monthly_active * (p["monthly_price"] * p["stripe_rate"] + p["stripe_fixed"])
    free_cold = free_mau * p["cold_sessions_per_free_mau"] * p["cold_cost"]
    free_clarify = new_free * p["clarify_cost"]
    free_infra = free_mau * p["free_infra_per_mau"]
    free_help = free_mau * p["free_help_per_mau"]
    free_subtotal = free_cold + free_clarify + free_infra + free_help
    support_hours = n * p["support_minutes_per_payer"] / 60.0
    outsourced_support_hours = max(0.0, support_hours - p["founder_support_hours"])
    costs = {
        "stripe": stripe,
        "paid_ai_and_speech": n * p["paid_ai_per_month"],
        "free_cold": free_cold,
        "free_clarify_once_per_new_entrant": free_clarify,
        "free_infrastructure": free_infra,
        "free_human_help": free_help,
        "free_usage_buffer": free_subtotal * p["free_buffer_rate"],
        "paid_support_outside_founder_hours": outsourced_support_hours * p["support_hourly_cost"],
        "paid_infrastructure": n * p["paid_infra_per_month"],
        "founder_payroll": plan["founder_payroll"],
        "other_non_support_payroll": plan["other_payroll"],
        "fixed_platform_and_admin": plan["fixed_cost"],
        "replacement_cash_acquisition": replacements * cash_cac,
    }
    net_revenue = gross_revenue - refunds
    total_operating_cost = sum(costs.values())
    profit = net_revenue - total_operating_cost
    pre_acquisition_profit = profit + costs["replacement_cash_acquisition"]
    tax_hold = max(0.0, profit) * p["illustrative_tax_reserve"]
    return {
        "active_payers": n,
        "annual_active_payers": annual_active,
        "monthly_active_payers": monthly_active,
        "replacement_new_payers_per_month": replacements,
        "new_activated_free_per_month": new_free,
        "active_free_mau": free_mau,
        "paid_support_hours": support_hours,
        "outsourced_paid_support_hours": outsourced_support_hours,
        "gross_revenue": gross_revenue,
        "refund_provision": refunds,
        "net_revenue_after_refunds": net_revenue,
        "costs": costs,
        "total_free_cost": free_subtotal * (1.0 + p["free_buffer_rate"]),
        "total_operating_cost": total_operating_cost,
        "operating_profit_before_tax": profit,
        "operating_margin_on_net_revenue": profit / net_revenue,
        "cash_cac_zero_profit_ceiling": pre_acquisition_profit / replacements,
        "illustrative_tax_reserve": tax_hold,
        "after_illustrative_tax_reserve": profit - tax_hold,
        "annualized_gross_revenue": gross_revenue * 12.0,
    }


def build_payload():
    r = retention(INPUTS)
    annual_revenue_per_active = r["active_annual_share"] * INPUTS["annual_price"]
    annual_revenue_per_active += (1.0 - r["active_annual_share"]) * INPUTS["monthly_price"] * 12.0
    required = 100_000_000.0 / annual_revenue_per_active
    cases = []
    for specification in SCENARIOS:
        inputs = dict(INPUTS, **specification["changes"])
        cases.append(dict(specification, inputs=inputs, rows=[calculate_row(plan, specification["cash_cac"], inputs) for plan in STAFFING]))
    return {
        "version": "current-offer-1.0",
        "date": "2026-11-15",
        "currency": "USD",
        "period": "Monthly mature steady state unless a field explicitly says annual.",
        "status": "Planning scenarios, not actual revenue or measured unit economics. No product changes.",
        "current_offer": {
            "monthly_price": 12,
            "annual_price": 79,
            "free_cold_allowance": "3 starts per day; modelled average usage is not a cap.",
            "free_clarify_allowance": "1 exercise per user lifetime, not per day.",
            "pro": "Current unlimited offer; neither $0.40 nor $1.50 is an enforced cost ceiling.",
        },
        "inputs": INPUTS,
        "provenance": {
            "prices_and_allowances": {"flag": "TEAM_REPORTED_CURRENT_PRODUCT", "source": "Team review and repository product configuration; verify current live state separately."},
            "retention_refunds_and_new_plan_mix": {"flag": "CATEGORY_PROXY_APPLIED_AS_ASSUMPTION", "source": "https://www.revenuecat.com/state-of-subscription-apps/", "detail": "Global Education subscription medians, mobile rather than our Stripe web cohort. S12 means after 12 renewals in this calculation."},
            "stripe": {"flag": "OFFICIAL_RATE_WITH_MERCHANT_ASSUMPTION", "sources": ["https://stripe.com/pricing", "https://stripe.com/billing/pricing"], "detail": "US domestic 2.9% + $0.30 plus Billing 0.7%; actual merchant geography, extra fees and taxes unverified."},
            "paid_ai_0_40": {"flag": "TEAM_USAGE_ESTIMATE_NOT_MEASURED", "detail": "Team estimate from typical token/audio workload; no provider invoice cohort establishes it."},
            "free_usage_conversion_and_costs": {"flag": "UNMEASURED_PLANNING_ASSUMPTIONS", "detail": "MAU ratio, session counts, 5% new-entrant conversion, per-exercise costs, help and buffer are explicit scenario inputs."},
            "staffing_and_infrastructure": {"flag": "PLANNING_ASSUMPTIONS", "detail": "Named staffing plans, not verified capacity or automatic hiring cliffs. Founder pay includes 20 paid-support hours; other payroll excludes support."},
            "cash_cac": {"flag": "UNMEASURED_ASSUMPTIONS_AND_TARGETS", "detail": "All cash CAC cases exclude founder labour already in payroll; no scaled channel volume established."},
        },
        "retention": r,
        "staffing": STAFFING,
        "scenarios": cases,
        "scale_to_100m": {
            "target_annualized_gross_revenue": 100_000_000,
            "annual_gross_revenue_per_active_payer": annual_revenue_per_active,
            "active_payers_required": required,
            "replacement_payers_per_year_at_target": required * 12.0 / r["weighted_paid_lifetime_months"],
            "status": "Revenue arithmetic only, not a market-share forecast or a profit/staffing forecast beyond 10,000 payers.",
        },
        "formulas": {
            "q": "(S12/S1)^(1/11)",
            "monthly_lifetime": "1+S1/(1-q)",
            "annual_lifetime": "12/(1-annualRenewal)",
            "weighted_lifetime": "annualNewShare*annualLifetime+(1-annualNewShare)*monthlyLifetime",
            "active_annual_share": "annualNewShare*annualLifetime/weightedLifetime",
            "replacement_payers": "activePayers/weightedLifetime",
            "new_activated_free": "replacementPayers/newFreeToPaid",
            "free_cost": "(activeFreeMAU*(coldSessions*coldCost+freeInfra+freeHelp)+newActivatedFree*clarifyCost)*(1+freeBuffer)",
            "operating_profit": "grossRevenue-refundProvision-SUM(namedOperatingCosts)",
            "cash_cac_zero_profit_ceiling": "(netRevenue-allOperatingCostsExceptCashAcquisition)/replacementPayers",
        },
        "limitations": [
            "No verified paying cohort, actual CAC, usage, conversion or retention in the evidence underlying these scenarios.",
            "Annual revenue and its processing fee are allocated over service months; this is not upfront bank cash. Refunds reduce revenue, not already incurred provider/processing costs.",
            "Free MAU counts entrants and returning free-phase users. It must include all new activated entrants. The 5% conversion applies to new entrants, not the entire recurring MAU stock.",
            "Clarify is budgeted once for every newly activated free entrant; recurring Cold/infrastructure/help are monthly MAU costs. Do not add the prior lifetime-trial free cost again.",
            "$10 is a target and $15 is a separate cash-spend scenario. Team labour is in payroll, so these figures cannot be compared to an unspecified fully loaded CAC without adjustment.",
            "Steady-state acquisition replaces churn. There is no extra growth budget, initial customer-base acquisition cost, launch runway or financing forecast in this model.",
            "A zero-profit CAC ceiling leaves no profit or extra growth money. A negative ceiling means this named staffing/free-usage scenario loses even with zero cash CAC.",
            "Actual corporate tax, sales tax/VAT, chargebacks, settlement delays, debt/interest and major capital expenditure are not calculated. The optional20% reserve is illustrative only.",
            "$1.50 is not a worst case for unlimited use. High usage, provider changes or a larger persistent free audience can erase profit.",
            "The $100M calculation demonstrates the required scale; it does not prove sufficient reachable demand or the cost of serving that scale.",
        ],
    }


def validate(payload):
    """Numerical checks using independent sums and single-variable differences."""
    checks = 0

    def check(condition, label):
        nonlocal checks
        checks += 1
        if not condition:
            raise AssertionError(label)

    def close(actual, expected, label):
        check(math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-7), label)

    p = payload["inputs"]
    r = payload["retention"]
    q = r["late_monthly_survival"]
    # Sum surviving cohorts directly through 1,200 monthly ages, avoiding the
    # closed-form lifetime expressions in retention(). Remainders are negligible.
    monthly_ages = [1.0] + [p["monthly_first_renewal"] * q ** (age - 1) for age in range(1, 1200)]
    annual_ages = [p["annual_renewal"] ** (age // 12) for age in range(1200)]
    close(math.fsum(monthly_ages), r["monthly_paid_lifetime_months"], "Monthly cohort sum")
    close(math.fsum(annual_ages), r["annual_paid_lifetime_months"], "Annual cohort sum")
    close(monthly_ages[12], p["monthly_survival_12"], "S12 convention")
    weighted_ages = [(1 - p["annual_new_share"]) * m + p["annual_new_share"] * a for m, a in zip(monthly_ages, annual_ages)]
    close(math.fsum(weighted_ages), r["weighted_paid_lifetime_months"], "Blended cohort sum")
    check(0 < r["active_annual_share"] < 1, "Active plan mix in range")
    check(0 < q < 1, "Finite monthly lifetime")

    for case in payload["scenarios"]:
        cp = case["inputs"]
        for row, plan in zip(case["rows"], payload["staffing"]):
            label = f"{case['id']}:{row['active_payers']}"
            n = row["active_payers"]
            costs = row["costs"]
            check(row["active_free_mau"] >= row["new_activated_free_per_month"], label + " new free fits MAU")
            close(row["annual_active_payers"] + row["monthly_active_payers"], n, label + " stock")
            close(row["replacement_new_payers_per_month"] * math.fsum(weighted_ages), n, label + " stationary stock")
            close(row["new_activated_free_per_month"] * cp["new_free_to_paid"], row["replacement_new_payers_per_month"], label + " conversion")
            # Independently recover earned revenue from the active plan stock.
            annual_rev = row["annual_active_payers"] * cp["annual_price"] / 12
            monthly_rev = row["monthly_active_payers"] * cp["monthly_price"]
            close(row["gross_revenue"], math.fsum([annual_rev, monthly_rev]), label + " revenue")
            close(row["refund_provision"], row["gross_revenue"] * cp["refund_rate"], label + " refunds")
            independent_stripe = cp["stripe_rate"] * row["gross_revenue"] + cp["stripe_fixed"] * (row["annual_active_payers"] / 12 + row["monthly_active_payers"])
            close(costs["stripe"], independent_stripe, label + " no refund of fees")
            free_names = ["free_cold", "free_clarify_once_per_new_entrant", "free_infrastructure", "free_human_help", "free_usage_buffer"]
            close(row["total_free_cost"], math.fsum(costs[k] for k in free_names), label + " free subtotal")
            close(costs["free_usage_buffer"], cp["free_buffer_rate"] * math.fsum(costs[k] for k in free_names[:-1]), label + " buffer")
            close(costs["free_clarify_once_per_new_entrant"], row["new_activated_free_per_month"] * cp["clarify_cost"], label + " Clarify not repeated MAU")
            close(costs["paid_support_outside_founder_hours"], max(0, n * cp["support_minutes_per_payer"] / 60 - cp["founder_support_hours"]) * cp["support_hourly_cost"], label + " founder hours once")
            close(costs["founder_payroll"], plan["founder_payroll"], label + " founder pay retained")
            close(costs["replacement_cash_acquisition"], row["replacement_new_payers_per_month"] * case["cash_cac"], label + " acquisition")
            close(row["total_operating_cost"], math.fsum(costs.values()), label + " cost sum")
            close(row["operating_profit_before_tax"], math.fsum([row["gross_revenue"], -row["refund_provision"]] + [-v for v in costs.values()]), label + " full P&L")
            no_acquisition_cost = math.fsum(v for k, v in costs.items() if k != "replacement_cash_acquisition")
            zero_profit = row["net_revenue_after_refunds"] - no_acquisition_cost - row["cash_cac_zero_profit_ceiling"] * row["replacement_new_payers_per_month"]
            close(zero_profit, 0, label + " CAC ceiling")
            close(row["after_illustrative_tax_reserve"] + row["illustrative_tax_reserve"], row["operating_profit_before_tax"], label + " planning hold")
            check(row["illustrative_tax_reserve"] >= 0, label + " no negative tax credit")
            close(row["annualized_gross_revenue"], row["gross_revenue"] * 12, label + " annualization")

    indexed = {case["id"]: case for case in payload["scenarios"]}
    for i in range(len(STAFFING)):
        base = indexed["cash_cac_19_25"]["rows"][i]
        fifteen = indexed["cash_cac_15"]["rows"][i]
        ten = indexed["cash_cac_10_target"]["rows"][i]
        high = indexed["paid_ai_1_50"]["rows"][i]
        free_heavy = indexed["free_cold_12_per_month"]["rows"][i]
        n = base["active_payers"]
        new = base["replacement_new_payers_per_month"]
        close(fifteen["operating_profit_before_tax"] - base["operating_profit_before_tax"], new * 4.25, "Only CAC19.25 ->15")
        close(ten["operating_profit_before_tax"] - base["operating_profit_before_tax"], new * 9.25, "Only CAC19.25 ->10")
        close(base["operating_profit_before_tax"] - high["operating_profit_before_tax"], n * 1.10, "Only paid AI0.40 ->1.50")
        extra_free = n * p["free_mau_per_payer"] * (12 - 5) * p["cold_cost"] * (1 + p["free_buffer_rate"])
        close(ten["operating_profit_before_tax"] - free_heavy["operating_profit_before_tax"], extra_free, "Only free Cold5 ->12")
    market = payload["scale_to_100m"]
    close(market["active_payers_required"] * market["annual_gross_revenue_per_active_payer"], 100_000_000, "100M revenue identity")
    close(market["replacement_payers_per_year_at_target"] * r["weighted_paid_lifetime_months"] / 12, market["active_payers_required"], "100M replacement stock identity")
    return checks


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate and compare with results.json without writing.")
    args = parser.parse_args(argv)
    payload = build_payload()
    checks = validate(payload)
    payload["validation"] = {"numerical_assertions": checks, "status": "PASS", "boundary": "Arithmetic consistency only; does not validate demand, assumptions, production behaviour or taxes."}
    destination = Path(__file__).resolve().with_name("results.json")
    if args.check:
        if not destination.exists():
            parser.exit(1, "FAIL: results.json is missing; run without --check first.\n")
        stored = json.loads(destination.read_text(encoding="utf-8"))
        if stored != payload:
            parser.exit(1, "FAIL: results.json differs from the calculation; no files changed.\n")
        print(f"PASS: {checks} numerical assertions; results.json matches; no files written.")
    else:
        destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote results.json; {checks} numerical assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
