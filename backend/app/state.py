from __future__ import annotations

from datetime import date
from typing import Any

from app import analytics, nessie
from app.db import supabase
from app.profile import merge_profile


def _loan_summary(student_id: str) -> dict[str, Any] | None:
    result = supabase().table("loans").select("*").eq("student_id", student_id).limit(1).execute()
    rows = result.data or []
    if not rows:
        return None
    loan = rows[0]
    return {
        "principal": float(loan["principal"]),
        "subsidized": float(loan["subsidized_amount"]),
        "unsubsidized": float(loan["unsubsidized_amount"]),
        "rate": float(loan["interest_rate"]),
        "disbursement_date": loan.get("disbursement_date"),
    }


def _concepts(student_id: str) -> list[str]:
    result = supabase().table("concepts_understood").select("concept_name").eq("student_id", student_id).execute()
    return [row["concept_name"] for row in (result.data or [])]


def build_student_state(student: dict[str, Any]) -> dict[str, Any]:
    account_id = student.get("nessie_account_id")
    if not account_id:
        return empty_state(student)

    account = nessie.get_account(account_id)
    deposits = nessie.list_deposits(account_id)
    purchases = nessie.list_purchases(account_id)
    bills = nessie.list_bills(account_id)
    balance = analytics.effective_balance(account, deposits, purchases)

    cadence = analytics.detect_cadence(deposits)
    avg_daily = analytics.average_daily_spend(purchases, bills)
    run = analytics.runway(balance, avg_daily, cadence["days_until_next_disbursement"])
    series = analytics.balance_series(
        balance,
        deposits,
        purchases,
        avg_daily=avg_daily,
        shortfall_date=run["runway_shortfall_date"],
        next_disbursement=cadence["next_disbursement_date"],
        upcoming_inflows=cadence.get("upcoming_inflows") or [],
    )

    return {
        "student_id": student["id"],
        "balance": round(balance, 2),
        "avg_daily_spend": avg_daily,
        "days_since_last_disbursement": cadence["days_since_last_disbursement"],
        "days_until_next_disbursement": cadence["days_until_next_disbursement"],
        "last_disbursement_date": cadence["last_disbursement_date"],
        "next_disbursement_date": cadence["next_disbursement_date"],
        "upcoming_inflows": cadence.get("upcoming_inflows") or [],
        "next_inflow": cadence.get("next_inflow"),
        "cadence_days": cadence["cadence_days"],
        "projected_balance_at_next_disbursement": run["projected_balance_at_next_disbursement"],
        "runway_shortfall_date": run["runway_shortfall_date"],
        "spending_by_category": analytics.spending_by_category(purchases),
        "loan_summary": _loan_summary(student["id"]),
        "concepts_understood": _concepts(student["id"]),
        "profile_flags": merge_profile(student.get("profile_flags")),
        "display_name": str(merge_profile(student.get("profile_flags")).get("full_name") or "").strip(),
        "upcoming_bills": _upcoming_bills(bills),
        "balance_series": series,
        "safe_to_spend": _safe_to_spend(balance, avg_daily, cadence["days_until_next_disbursement"]),
    }


def _upcoming_bills(bills: list[dict[str, Any]]) -> list[dict[str, Any]]:
    today = date.today()
    rows: list[dict[str, Any]] = []
    for bill in bills:
        recurring = bill.get("recurring_date")
        due = None
        try:
            if recurring not in (None, ""):
                due = analytics.next_recurring_date(int(recurring), today)
        except (TypeError, ValueError):
            due = None
        rows.append(
            {
                "payee": bill.get("payee") or bill.get("nickname"),
                "amount": bill.get("payment_amount"),
                "recurring_date": recurring,
                "next_due": due.isoformat() if due else None,
                "days_until": (due - today).days if due else None,
            }
        )
    rows.sort(key=lambda row: row.get("next_due") or "9999-12-31")
    return rows


def _safe_to_spend(balance: float, avg_daily: float, days_until: int | None) -> float:
    if days_until is None:
        return round(max(balance, 0), 2)
    needed = avg_daily * days_until
    return round(max(balance - needed, 0), 2)


def empty_state(student: dict[str, Any]) -> dict[str, Any]:
    return {
        "student_id": student["id"],
        "balance": 0,
        "avg_daily_spend": 0,
        "days_since_last_disbursement": None,
        "days_until_next_disbursement": None,
        "last_disbursement_date": None,
        "next_disbursement_date": None,
        "upcoming_inflows": [],
        "next_inflow": None,
        "cadence_days": None,
        "projected_balance_at_next_disbursement": None,
        "runway_shortfall_date": None,
        "spending_by_category": {},
        "loan_summary": _loan_summary(student["id"]),
        "concepts_understood": _concepts(student["id"]),
        "profile_flags": merge_profile(student.get("profile_flags")),
        "display_name": str(merge_profile(student.get("profile_flags")).get("full_name") or "").strip(),
        "upcoming_bills": [],
        "balance_series": [],
        "safe_to_spend": 0,
        "warning": "No Nessie account linked. Run bootstrap/seed.",
    }
