from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import median
from typing import Any

from app.config import DISBURSEMENT_MULTIPLIER

INFLOW_LABELS = {
    "work_study": "Work-study",
    "scholarship": "Scholarship",
    "pell": "Pell",
    "loan_refund": "Loan refund",
    "aid_refund": "Aid refund",
}

INFLOW_CADENCE = {
    "work_study": 14,
    "scholarship": 120,
    "pell": 105,
    "loan_refund": 105,
    "aid_refund": 105,
}


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def _tx_date(tx: dict[str, Any], *keys: str) -> date | None:
    for key in keys:
        parsed = _parse_date(tx.get(key))
        if parsed:
            return parsed
    return None


def classify_inflow(description: str | None, amount: float = 0, threshold: float | None = None) -> str | None:
    desc = (description or "").lower()
    if any(word in desc for word in ("parent transfer", "demo pad")):
        return None
    if any(word in desc for word in ("work-study", "work study", "payroll", "student employment", "campus job")):
        return "work_study"
    if "pell" in desc:
        return "pell"
    if any(word in desc for word in ("scholarship", "fellowship")):
        return "scholarship"
    if any(word in desc for word in ("loan refund", "direct loan", "stafford")):
        return "loan_refund"
    if any(word in desc for word in ("financial aid", "aid refund", "disbursement", "refund")):
        return "aid_refund"
    if threshold is not None and amount >= threshold:
        return "aid_refund"
    return None


def _advance_to_future(last: date, cadence_days: int, today: date) -> date:
    nxt = last + timedelta(days=max(cadence_days, 1))
    while nxt <= today:
        nxt += timedelta(days=max(cadence_days, 1))
    return nxt


def detect_inflows(deposits: list[dict[str, Any]], today: date | None = None) -> list[dict[str, Any]]:
    """Project the next work-study, scholarship, Pell, and loan/aid refund dates separately."""
    today = today or date.today()
    amounts = [float(d.get("amount") or 0) for d in deposits if float(d.get("amount") or 0) > 0]
    threshold = (median(amounts) * DISBURSEMENT_MULTIPLIER) if amounts else None

    streams: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for dep in deposits:
        amount = float(dep.get("amount") or 0)
        when = _tx_date(dep, "transaction_date", "payment_date")
        if amount <= 0 or not when:
            continue
        kind = classify_inflow(str(dep.get("description") or ""), amount, threshold)
        if not kind:
            continue
        streams[kind].append({"date": when, "amount": amount, "description": dep.get("description")})

    upcoming: list[dict[str, Any]] = []
    for kind, rows in streams.items():
        rows.sort(key=lambda row: row["date"])
        dates = [row["date"] for row in rows]
        cadence_days = INFLOW_CADENCE[kind]
        if len(dates) >= 2:
            gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
            positive = [gap for gap in gaps if gap > 0]
            if positive:
                cadence_days = int(median(positive))
        typical = float(median([row["amount"] for row in rows]))
        copies = 2 if kind == "work_study" else 1
        nxt = _advance_to_future(dates[-1], cadence_days, today)
        for index in range(copies):
            when = nxt + timedelta(days=cadence_days * index)
            upcoming.append(
                {
                    "id": f"{kind}-{when.isoformat()}",
                    "kind": kind,
                    "label": INFLOW_LABELS[kind],
                    "date": when.isoformat(),
                    "amount": round(typical, 2),
                    "days_until": (when - today).days,
                    "cadence_days": cadence_days,
                }
            )

    upcoming.sort(key=lambda row: row["date"])
    return upcoming[:8]


def detect_cadence(deposits: list[dict[str, Any]], today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    inflows = detect_inflows(deposits, today)
    amounts = [float(d.get("amount") or 0) for d in deposits if float(d.get("amount") or 0) > 0]
    if not amounts:
        return {
            "disbursements": [],
            "upcoming_inflows": [],
            "cadence_days": None,
            "last_disbursement_date": None,
            "next_disbursement_date": None,
            "days_since_last_disbursement": None,
            "days_until_next_disbursement": None,
        }

    med = median(amounts)
    threshold = med * DISBURSEMENT_MULTIPLIER
    tagged = []
    aid_like: list[date] = []
    for dep in deposits:
        amount = float(dep.get("amount") or 0)
        when = _tx_date(dep, "transaction_date", "payment_date")
        kind = classify_inflow(str(dep.get("description") or ""), amount, threshold)
        if amount >= threshold and when:
            tagged.append({"date": when, "amount": amount, "description": dep.get("description")})
        if when and kind in {"pell", "loan_refund", "aid_refund", "scholarship"}:
            aid_like.append(when)
    tagged.sort(key=lambda row: row["date"])

    cadence_days = None
    if len(tagged) >= 2:
        gaps = [(tagged[i]["date"] - tagged[i - 1]["date"]).days for i in range(1, len(tagged))]
        cadence_days = int(median(gaps)) if gaps else None

    last_aid = max(aid_like) if aid_like else (tagged[-1]["date"] if tagged else None)
    nxt = inflows[0] if inflows else None
    nxt_date = datetime.fromisoformat(nxt["date"]).date() if nxt else None
    if nxt and cadence_days is None:
        cadence_days = nxt.get("cadence_days")

    return {
        "disbursements": tagged,
        "upcoming_inflows": inflows,
        "cadence_days": cadence_days,
        "last_disbursement_date": last_aid.isoformat() if last_aid else None,
        "next_disbursement_date": nxt_date.isoformat() if nxt_date else None,
        "days_since_last_disbursement": (today - last_aid).days if last_aid else None,
        "days_until_next_disbursement": (nxt_date - today).days if nxt_date else None,
        "next_inflow": nxt,
        "median_deposit": med,
        "threshold": threshold,
    }


def effective_balance(
    account: dict[str, Any],
    deposits: list[dict[str, Any]],
    purchases: list[dict[str, Any]],
) -> float:
    """Nessie often leaves account.balance at the opening amount. Rebuild from the ledger."""
    listed = float(account.get("balance") or 0)
    inflow = sum(float(row.get("amount") or 0) for row in deposits)
    outflow = sum(float(row.get("amount") or 0) for row in purchases)
    if inflow > 0 and listed < inflow * 0.25:
        return round(max(listed + inflow - outflow, 0), 2)
    return round(max(listed, 0), 2)


def average_daily_spend(purchases: list[dict[str, Any]], bills: list[dict[str, Any]], today: date | None = None) -> float:
    today = today or date.today()
    window_start = today - timedelta(days=30)
    total = 0.0
    for purchase in purchases:
        when = _tx_date(purchase, "purchase_date", "transaction_date")
        if when and when >= window_start:
            total += float(purchase.get("amount") or 0)
    monthly_bills = sum(float(bill.get("payment_amount") or 0) for bill in bills)
    total += monthly_bills
    return round(total / 30.0, 2)


def _purchase_category(description: str) -> str:
    desc = (description or "other").lower()
    rules: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("food_delivery", ("doordash", "uber eats", "grubhub", "chipotle", "dining", "restaurant", "pizza", "dinner")),
        ("coffee", ("starbucks", "dunkin", "coffee", "cafe")),
        ("groceries", ("heb", "kroger", "trader joe", "grocery", "walmart", "whole foods")),
        ("nightlife", ("bar", "club", "nightlife", "concert")),
        ("rideshare", ("uber", "lyft", "ride", "metro", "bus")),
        ("subscriptions", ("spotify", "netflix", "hulu", "disney+", "apple music", "subscription")),
        ("phone", ("verizon", "t-mobile", "at&t", "cricket", "phone bill")),
        ("gym", ("gym", "planet fitness", "rec center")),
        ("campus_bookstore", ("book", "chegg", "course materials")),
        ("clothes", ("nike", "h&m", "zara", "uniqlo", "clothing", "thrift")),
    )
    for key, words in rules:
        if any(word in desc for word in words):
            return key
    return "other"


def spending_by_category(
    purchases: list[dict[str, Any]],
    today: date | None = None,
    window_days: int = 30,
) -> dict[str, float]:
    today = today or date.today()
    window_start = today - timedelta(days=window_days)
    buckets: dict[str, float] = defaultdict(float)
    for purchase in purchases:
        when = _tx_date(purchase, "purchase_date", "transaction_date")
        if when and when < window_start:
            continue
        key = _purchase_category(str(purchase.get("description") or "other"))
        buckets[key] += float(purchase.get("amount") or 0)
    return {k: round(v, 2) for k, v in buckets.items()}


def next_recurring_date(day_of_month: int | None, today: date | None = None) -> date | None:
    today = today or date.today()
    if not day_of_month:
        return None
    day = int(day_of_month)
    if day < 1:
        return None

    def clamp(year: int, month: int) -> date:
        last = calendar.monthrange(year, month)[1]
        return date(year, month, min(day, last))

    candidate = clamp(today.year, today.month)
    if candidate >= today:
        return candidate
    if today.month == 12:
        return clamp(today.year + 1, 1)
    return clamp(today.year, today.month + 1)


def runway(
    balance: float,
    avg_daily: float,
    days_until: int | None,
    today: date | None = None,
) -> dict[str, Any]:
    today = today or date.today()
    if days_until is None:
        return {
            "projected_balance_at_next_disbursement": None,
            "runway_shortfall_date": None,
        }
    projected = round(balance - (avg_daily * days_until), 2)
    shortfall = None
    if avg_daily > 0 and balance > 0:
        days_left = int(balance // avg_daily)
        if days_left < days_until:
            shortfall = (today + timedelta(days=days_left)).isoformat()
    elif balance <= 0:
        shortfall = today.isoformat()
    return {
        "projected_balance_at_next_disbursement": projected,
        "runway_shortfall_date": shortfall,
    }


def balance_series(
    current_balance: float,
    deposits: list[dict[str, Any]],
    purchases: list[dict[str, Any]],
    today: date | None = None,
    horizon_days: int = 90,
    avg_daily: float = 0,
    shortfall_date: str | None = None,
    next_disbursement: str | None = None,
    upcoming_inflows: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    today = today or date.today()
    events: list[tuple[date, float]] = []
    for dep in deposits:
        when = _tx_date(dep, "transaction_date", "payment_date")
        if when:
            events.append((when, float(dep.get("amount") or 0)))
    for purchase in purchases:
        when = _tx_date(purchase, "purchase_date", "transaction_date")
        if when:
            events.append((when, -float(purchase.get("amount") or 0)))
    events.sort()

    by_day: dict[date, float] = defaultdict(float)
    for when, delta in events:
        by_day[when] += delta

    start = today - timedelta(days=120)
    cursor = current_balance
    # Walk backward: undo each day's net after that day.
    hist: dict[date, float] = {today: current_balance}
    day = today
    while day > start:
        prev = day - timedelta(days=1)
        cursor = cursor - by_day.get(day, 0)
        hist[prev] = round(cursor, 2)
        day = prev

    series = [
        {"date": d.isoformat(), "balance": hist[d], "kind": "actual"}
        for d in sorted(hist)
        if d <= today
    ]

    inflow_on: dict[date, float] = defaultdict(float)
    last_inflow: date | None = None
    for row in upcoming_inflows or []:
        when = _parse_date(str(row.get("date") or ""))
        if not when or when <= today:
            continue
        inflow_on[when] += float(row.get("amount") or 0)
        last_inflow = when if last_inflow is None else max(last_inflow, when)

    end = today + timedelta(days=horizon_days)
    if next_disbursement:
        end = max(end, datetime.fromisoformat(next_disbursement).date())
    if last_inflow:
        end = max(end, last_inflow)
    if shortfall_date:
        end = max(end, datetime.fromisoformat(shortfall_date).date())
    projected = current_balance
    day = today
    while day < end:
        day += timedelta(days=1)
        projected = round(projected - avg_daily + inflow_on.get(day, 0), 2)
        series.append({"date": day.isoformat(), "balance": projected, "kind": "projected"})
        later = any(when > day for when in inflow_on)
        if projected <= 0 and not later:
            break
    return series
