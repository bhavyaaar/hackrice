from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app import nessie
from app.db import supabase
from app.deps import get_user_id
from app.state import build_student_state

router = APIRouter()

DEFAULT_FLAGS = {"international": False, "first_gen": True, "has_ssn": True}


@router.post("/me/bootstrap")
def bootstrap(user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    existing = supabase().table("students").select("*").eq("user_id", user_id).limit(1).execute()
    if existing.data:
        student = existing.data[0]
        return {"student": student, "state": build_student_state(student), "created": False}

    inserted = (
        supabase()
        .table("students")
        .insert({"user_id": user_id, "profile_flags": DEFAULT_FLAGS})
        .execute()
    )
    student = inserted.data[0]

    supabase().table("loans").insert(
        {
            "student_id": student["id"],
            "principal": 12000,
            "subsidized_amount": 7000,
            "unsubsidized_amount": 5000,
            "interest_rate": 0.055,
            "disbursement_date": date.today().isoformat(),
        }
    ).execute()

    try:
        customer = nessie.create_customer("Jordan", "Nguyen")
        customer_id = customer.get("_id") or customer.get("id")
        account = nessie.create_account(customer_id, 520)
        account_id = account.get("_id") or account.get("id")
        supabase().table("students").update(
            {"nessie_customer_id": customer_id, "nessie_account_id": account_id}
        ).eq("id", student["id"]).execute()
        student["nessie_customer_id"] = customer_id
        student["nessie_account_id"] = account_id
    except Exception as exc:
        student["nessie_error"] = str(exc)

    return {"student": student, "state": build_student_state(student), "created": True}


@router.get("/student-state")
def student_state(user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    result = supabase().table("students").select("*").eq("user_id", user_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Call POST /api/me/bootstrap first")
    return build_student_state(result.data[0])
