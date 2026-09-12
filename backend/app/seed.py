"""Seed one Nessie demo persona. Run: python -m app.seed"""

from __future__ import annotations

from datetime import date, timedelta

from app import nessie
from app.config import NESSIE_API_KEY


def daterange_back(days: int) -> date:
    return date.today() - timedelta(days=days)


def run() -> None:
    if not NESSIE_API_KEY:
        raise SystemExit("Set NESSIE_API_KEY before seeding")

    customer = nessie.create_customer("Jordan", "Nguyen")
    customer_id = customer.get("_id") or customer.get("id")
    account = nessie.create_account(customer_id, 520)
    account_id = account.get("_id") or account.get("id")

    merchants = {
        "food": nessie.create_merchant("DoorDash Campus", "food"),
        "ride": nessie.create_merchant("Uber", "transport"),
        "books": nessie.create_merchant("Campus Bookstore", "education"),
        "sub": nessie.create_merchant("Spotify", "entertainment"),
    }
    mid = {k: (v.get("_id") or v.get("id")) for k, v in merchants.items()}

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

    print("Seeded Nessie customer", customer_id)
    print("Account", account_id)
    print("Attach these ids to public.students after signup, or rely on /api/me/bootstrap")


if __name__ == "__main__":
    run()
