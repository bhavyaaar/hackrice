from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import median
from typing import Any

from app.config import DISBURSEMENT_MULTIPLIER


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


def detect_cadence(deposits: list[dict[str, Any]], today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    amounts = [float(d.get("amount") or 0) for d in deposits if float(d.get("amount") or 0) > 0]
    if not amounts:
        return {
            "disbursements": [],
            "cadence_days": None,
            "last_disbursement_date": None,
            "next_disbursement_date": None,
            "days_since_last_disbursement": None,
            "days_until_next_disbursement": None,
        }

    med = median(amounts)
    threshold = med * DISBURSEMENT_MULTIPLIER
    tagged = []
    for dep in deposits:
        amount = float(dep.get("amount") or 0)
        when = _tx_date(dep, "transaction_date", "payment_date", "description")
        if amount >= threshold and when:
            tagged.append({"date": when, "amount": amount, "description": dep.get("description")})
    tagged.sort(key=lambda row: row["date"])

    cadence_days = None
    if len(tagged) >= 2:
        gaps = [(tagged[i]["date"] - tagged[i - 1]["date"]).days for i in range(1, len(tagged))]
        cadence_days = int(median(gaps)) if gaps else None

    last = tagged[-1]["date"] if tagged else None
    nxt = (last + timedelta(days=cadence_days)) if last and cadence_days else None
    return {
        "disbursements": tagged,
        "cadence_days": cadence_days,
        "last_disbursement_date": last.isoformat() if last else None,
        "next_disbursement_date": nxt.isoformat() if nxt else None,
        "days_since_last_disbursement": (today - last).days if last else None,
        "days_until_next_disbursement": (nxt - today).days if nxt else None,
        "median_deposit": med,
        "threshold": threshold,
    }


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


def spending_by_category(purchases: list[dict[str, Any]]) -> dict[str, float]:
    buckets: dict[str, float] = defaultdict(float)
    for purchase in purchases:
        desc = (purchase.get("description") or "other").lower()
        if any(word in desc for word in ("uber", "lyft", "ride")):
            key = "rideshare"
        elif any(word in desc for word in ("doordash", "uber eats", "food", "dining", "chipotle")):
            key = "food_delivery"
        elif any(word in desc for word in ("spotify", "netflix", "hulu", "subscription")):
            key = "subscriptions"
        elif "book" in desc:
            key = "campus_bookstore"
        else:
            key = "other"
        buckets[key] += float(purchase.get("amount") or 0)
    return {k: round(v, 2) for k, v in buckets.items()}


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

    end = today + timedelta(days=horizon_days)
    if next_disbursement:
        end = max(end, datetime.fromisoformat(next_disbursement).date())
    if shortfall_date:
        end = max(end, datetime.fromisoformat(shortfall_date).date())
    projected = current_balance
    day = today
    while day < end:
        day += timedelta(days=1)
        projected = round(projected - avg_daily, 2)
        series.append({"date": day.isoformat(), "balance": projected, "kind": "projected"})
        if projected <= 0:
            break
    return series
