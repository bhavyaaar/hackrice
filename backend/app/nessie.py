from typing import Any

import httpx

from app.config import NESSIE_API_KEY, NESSIE_BASE


class NessieError(RuntimeError):
    pass


def _params() -> dict[str, str]:
    if not NESSIE_API_KEY:
        raise NessieError("NESSIE_API_KEY is not set")
    return {"key": NESSIE_API_KEY}


def _unwrap(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    for key in ("objectCreated", "object"):
        if key in payload:
            return payload[key]
    return payload


def get(path: str) -> Any:
    with httpx.Client(timeout=30) as client:
        res = client.get(f"{NESSIE_BASE}{path}", params=_params())
        res.raise_for_status()
        return res.json()


def post(path: str, body: dict[str, Any]) -> Any:
    with httpx.Client(timeout=30) as client:
        res = client.post(f"{NESSIE_BASE}{path}", params=_params(), json=body)
        res.raise_for_status()
        return _unwrap(res.json())


def get_account(account_id: str) -> dict[str, Any]:
    return get(f"/accounts/{account_id}")


def list_deposits(account_id: str) -> list[dict[str, Any]]:
    data = get(f"/accounts/{account_id}/deposits")
    return data if isinstance(data, list) else []


def list_purchases(account_id: str) -> list[dict[str, Any]]:
    data = get(f"/accounts/{account_id}/purchases")
    return data if isinstance(data, list) else []


def list_bills(account_id: str) -> list[dict[str, Any]]:
    data = get(f"/accounts/{account_id}/bills")
    return data if isinstance(data, list) else []


def create_customer(first_name: str, last_name: str) -> dict[str, Any]:
    return post(
        "/customers",
        {
            "first_name": first_name,
            "last_name": last_name,
            "address": {
                "street_number": "6100",
                "street_name": "Main St",
                "city": "Houston",
                "state": "TX",
                "zip": "77005",
            },
        },
    )


def create_account(customer_id: str, balance: float, nickname: str = "Student Checking") -> dict[str, Any]:
    return post(
        f"/customers/{customer_id}/accounts",
        {"type": "Checking", "nickname": nickname, "rewards": 0, "balance": round(balance, 2)},
    )


def create_merchant(name: str, category: str) -> dict[str, Any]:
    return post(
        "/merchants",
        {
            "name": name,
            "category": category,
            "address": {
                "street_number": "1",
                "street_name": "Campus Dr",
                "city": "Houston",
                "state": "TX",
                "zip": "77005",
            },
            "geocode": {"lat": 29.7174, "lng": -95.4018},
        },
    )


def create_deposit(account_id: str, amount: float, date: str, description: str) -> dict[str, Any]:
    return post(
        f"/accounts/{account_id}/deposits",
        {
            "medium": "balance",
            "transaction_date": date,
            "status": "completed",
            "amount": round(amount, 2),
            "description": description,
        },
    )


def create_purchase(
    account_id: str,
    merchant_id: str,
    amount: float,
    date: str,
    description: str,
) -> dict[str, Any]:
    return post(
        f"/accounts/{account_id}/purchases",
        {
            "merchant_id": merchant_id,
            "medium": "balance",
            "purchase_date": date,
            "amount": round(amount, 2),
            "status": "completed",
            "description": description,
        },
    )


def create_bill(account_id: str, payee: str, amount: float, payment_date: str, recurring_date: int) -> dict[str, Any]:
    return post(
        f"/accounts/{account_id}/bills",
        {
            "status": "recurring",
            "payee": payee,
            "nickname": payee,
            "payment_date": payment_date,
            "recurring_date": recurring_date,
            "payment_amount": round(amount, 2),
        },
    )
