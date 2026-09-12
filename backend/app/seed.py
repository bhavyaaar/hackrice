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
        if cursor.weekday() == 4:
            nessie.create_purchase(account_id, mid["ride"], round(12 * bump, 2), cursor.isoformat(), "Uber to campus")
        if cursor.day == 3:
            nessie.create_purchase(account_id, mid["sub"], 11.99, cursor.isoformat(), "Spotify")
        if cursor.day == 12:
            nessie.create_purchase(account_id, mid["books"], 28.00, cursor.isoformat(), "Campus bookstore")
        cursor += timedelta(days=3)

    nessie.create_bill(account_id, "Campus Housing", 850, date.today().replace(day=1).isoformat(), 1)
    nessie.create_bill(account_id, "Netflix", 15.49, date.today().replace(day=12).isoformat(), 12)
    return mid


def create_account() -> tuple[str, str, dict[str, str]]:
    customer = nessie.create_customer("Jordan", "Nguyen")
    customer_id = _id(customer)
    account = nessie.create_account(customer_id, 520)
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
            return student
        merchant_ids = create_merchants()
        seed_history(account_id, merchant_ids)
        if not student.get("demo_merchant_id"):
            supabase().table("students").update({"demo_merchant_id": merchant_ids["food"]}).eq("id", student["id"]).execute()
            student["demo_merchant_id"] = merchant_ids["food"]
        return student

    customer_id, account_id, merchant_ids = create_account()
    seed_history(account_id, merchant_ids)
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
