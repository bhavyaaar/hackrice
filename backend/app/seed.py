"""Seed one Nessie demo persona. Run: python -m app.seed

Also used by bootstrap to attach an account to a student who signed up before
NESSIE_API_KEY was set.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app import nessie
from app.config import NESSIE_API_KEY
from app.db import supabase


def daterange_back(days: int) -> date:
    return date.today() - timedelta(days=days)


def _id(row: dict[str, Any]) -> str:
    value = row.get("_id") or row.get("id")
    if not value:
        raise RuntimeError(f"Nessie response missing id: {row}")
    return str(value)


def create_merchants() -> dict[str, str]:
    merchants = {
        "food": nessie.create_merchant("DoorDash Campus", "food"),
        "ride": nessie.create_merchant("Uber", "transport"),
        "books": nessie.create_merchant("Campus Bookstore", "education"),
        "sub": nessie.create_merchant("Spotify", "entertainment"),
        "coffee": nessie.create_merchant("Starbucks", "food"),
        "grocery": nessie.create_merchant("H-E-B", "grocery"),
        "night": nessie.create_merchant("Campus Bar", "entertainment"),
        "gym": nessie.create_merchant("Rec Center", "health"),
        "phone": nessie.create_merchant("T-Mobile", "utilities"),
        "clothes": nessie.create_merchant("Thrift Shop", "shopping"),
    }
    return {k: _id(v) for k, v in merchants.items()}


def seed_history(account_id: str, merchant_ids: dict[str, str] | None = None) -> dict[str, str]:
    mid = merchant_ids or create_merchants()
    last_aid = daterange_back(41)
    prev_aid = last_aid - timedelta(days=105)
    nessie.create_deposit(account_id, 4200, prev_aid.isoformat(), "Financial Aid Refund")
    nessie.create_deposit(account_id, 4350, last_aid.isoformat(), "Financial Aid Refund")

    payroll_day = daterange_back(170)
    while payroll_day <= date.today():
        nessie.create_deposit(account_id, 380, payroll_day.isoformat(), "Payroll")
        payroll_day += timedelta(days=14)

    cursor = daterange_back(160)
    while cursor <= date.today():
        bump = 2.2 if abs((cursor - last_aid).days) < 8 or abs((cursor - prev_aid).days) < 8 else 1.0
        nessie.create_purchase(account_id, mid["food"], round(14 * bump, 2), cursor.isoformat(), "DoorDash dinner")
        if cursor.weekday() in (0, 2):
            nessie.create_purchase(account_id, mid["coffee"], round(6.25 * bump, 2), cursor.isoformat(), "Starbucks")
        if cursor.weekday() == 4:
            nessie.create_purchase(account_id, mid["ride"], round(12 * bump, 2), cursor.isoformat(), "Uber to campus")
        if cursor.weekday() == 5:
            nessie.create_purchase(account_id, mid["night"], round(18 * bump, 2), cursor.isoformat(), "Bar with friends")
        if cursor.day == 3:
            nessie.create_purchase(account_id, mid["sub"], 11.99, cursor.isoformat(), "Spotify")
        if cursor.day == 8:
            nessie.create_purchase(account_id, mid["grocery"], round(42 * bump, 2), cursor.isoformat(), "H-E-B groceries")
        if cursor.day == 12:
            nessie.create_purchase(account_id, mid["books"], 28.00, cursor.isoformat(), "Campus bookstore")
        if cursor.day == 15:
            nessie.create_purchase(account_id, mid["gym"], 25.00, cursor.isoformat(), "Rec center gym")
        if cursor.day == 20:
            nessie.create_purchase(account_id, mid["phone"], 45.00, cursor.isoformat(), "T-Mobile phone bill")
        if cursor.day == 22 and cursor.month % 2 == 0:
            nessie.create_purchase(account_id, mid["clothes"], 32.00, cursor.isoformat(), "Thrift clothing")
        cursor += timedelta(days=3)

    nessie.create_bill(account_id, "Campus Housing", 390, date.today().replace(day=1).isoformat(), 1)
    nessie.create_bill(account_id, "Netflix", 15.49, date.today().replace(day=12).isoformat(), 12)
    return mid


def ensure_category_sample(account_id: str) -> None:
    """Backfill colorful demo categories on accounts seeded before this existed."""
    purchases = nessie.list_purchases(account_id)
    blob = " ".join(str(row.get("description") or "") for row in purchases).lower()
    if "starbucks" in blob and "h-e-b" in blob:
        return
    mid = create_merchants()
    today = date.today()
    samples = (
        (mid["coffee"], 6.25, 2, "Starbucks"),
        (mid["grocery"], 47.80, 6, "H-E-B groceries"),
        (mid["night"], 22.00, 9, "Bar with friends"),
        (mid["gym"], 25.00, 14, "Rec center gym"),
        (mid["phone"], 45.00, 18, "T-Mobile phone bill"),
        (mid["clothes"], 32.00, 21, "Thrift clothing"),
        (mid["coffee"], 5.75, 24, "Starbucks"),
        (mid["grocery"], 38.40, 27, "H-E-B groceries"),
    )
    for merchant_id, amount, days_ago, desc in samples:
        nessie.create_purchase(
            account_id,
            merchant_id,
            amount,
            (today - timedelta(days=days_ago)).isoformat(),
            desc,
        )


def ensure_demo_spendable(account_id: str, today_target: float = 24) -> None:
    """Pad checking so the dashboard can show a 'spend today' number for demos.

    Uses a parent-transfer deposit under the aid-detection threshold so it
    does not reset disbursement cadence.
    """
    from app import analytics

    deposits = nessie.list_deposits(account_id)
    purchases = nessie.list_purchases(account_id)
    account = nessie.get_account(account_id)
    balance = analytics.effective_balance(account, deposits, purchases)
    bills = nessie.list_bills(account_id)
    reserved = sum(float(bill.get("payment_amount") or 0) for bill in bills)
    cadence = analytics.detect_cadence(deposits)
    days = cadence.get("days_until_next_disbursement") or 30
    leftover = balance - reserved
    if leftover / max(int(days), 1) >= today_target:
        return

    need = reserved + today_target * max(int(days), 1) - balance + 40
    if need <= 0:
        return
    remaining = need
    while remaining > 0:
        chunk = min(remaining, 900)
        nessie.create_deposit(
            account_id,
            round(chunk, 2),
            date.today().isoformat(),
            "Parent transfer demo pad",
        )
        remaining -= chunk


def create_account() -> tuple[str, str, dict[str, str]]:
    customer = nessie.create_customer("Jordan", "Nguyen")
    customer_id = _id(customer)
    account = nessie.create_account(customer_id, 2400)
    account_id = _id(account)
    merchant_ids = create_merchants()
    return customer_id, account_id, merchant_ids


def provision_student(student: dict[str, Any]) -> dict[str, Any]:
    """Create + seed a Nessie account if this student has none. Skip if already linked with deposits."""
    if not NESSIE_API_KEY:
        student["nessie_error"] = "NESSIE_API_KEY is not set"
        return student

    account_id = student.get("nessie_account_id")
    if account_id:
        deposits = nessie.list_deposits(account_id)
        if deposits:
            try:
                ensure_category_sample(account_id)
                ensure_demo_spendable(account_id)
            except Exception:
                pass
            return student
        merchant_ids = create_merchants()
        seed_history(account_id, merchant_ids)
        try:
            ensure_demo_spendable(account_id)
        except Exception:
            pass
        if not student.get("demo_merchant_id"):
            supabase().table("students").update({"demo_merchant_id": merchant_ids["food"]}).eq("id", student["id"]).execute()
            student["demo_merchant_id"] = merchant_ids["food"]
        return student

    customer_id, account_id, merchant_ids = create_account()
    seed_history(account_id, merchant_ids)
    try:
        ensure_demo_spendable(account_id)
    except Exception:
        pass
    updates = {
        "nessie_customer_id": customer_id,
        "nessie_account_id": account_id,
        "demo_merchant_id": merchant_ids["food"],
    }
    supabase().table("students").update(updates).eq("id", student["id"]).execute()
    student.update(updates)
    return student


def run() -> tuple[str, str]:
    if not NESSIE_API_KEY:
        raise SystemExit("Set NESSIE_API_KEY before seeding")
    customer_id, account_id, merchant_ids = create_account()
    seed_history(account_id, merchant_ids)
    print("Seeded Nessie customer", customer_id)
    print("Account", account_id)
    print("Attach these ids to public.students after signup, or rely on /api/me/bootstrap")
    return customer_id, account_id


if __name__ == "__main__":
    run()
