from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import nessie
from app.agents import run_agent
from app.db import supabase
from app.deps import get_student
from app.state import build_student_state

router = APIRouter()


class SimulatePurchaseBody(BaseModel):
    amount: float = 42.50
    description: str = "Late-night DoorDash"


@router.post("/simulate-purchase")
def simulate_purchase(body: SimulatePurchaseBody, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    account_id = student.get("nessie_account_id")
    merchant_id = student.get("demo_merchant_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="No Nessie account on this student")
    if not merchant_id:
        merchant = nessie.create_merchant("Campus Eats", "food")
        merchant_id = merchant.get("_id") or merchant.get("id")
        supabase().table("students").update({"demo_merchant_id": merchant_id}).eq("id", student["id"]).execute()

    from datetime import date

    purchase = nessie.create_purchase(account_id, merchant_id, body.amount, date.today().isoformat(), body.description)
    student = supabase().table("students").select("*").eq("id", student["id"]).limit(1).execute().data[0]
    state = build_student_state(student)
    message = (
        f"I just spent ${body.amount:.2f} on {body.description}. "
        "How does this change my cash until the next aid drop?"
    )
    agent = run_agent("anchor", student, state, message)
    return {"purchase": purchase, **agent}
