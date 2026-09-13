from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from app.db import supabase
from app.deps import get_access_claims, get_student, get_user_id
from app.profile import apply_updates, merge_profile
from app.seed import provision_student
from app.state import build_student_state

router = APIRouter()


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    school: str | None = None
    class_year: Literal["first_year", "sophomore", "junior", "senior", "grad"] | None = None
    graduation_year: str | None = None
    housing: Literal["on_campus", "off_campus"] | None = None
    first_gen: bool | None = None
    international: bool | None = None
    has_ssn: bool | None = None
    pell: bool | None = None
    work_study_eligible: bool | None = None
    safe_to_spend_style: Literal["strict", "buffer_20"] | None = None
    notify_bills: bool | None = None
    notify_aid: bool | None = None
    anchor_nags_doordash: bool | None = None
    splits_rent: bool | None = None
    handled_bills: list[str] | None = None


def _persist_flags(student: dict[str, Any], flags: dict[str, Any]) -> dict[str, Any]:
    updated = (
        supabase()
        .table("students")
        .update({"profile_flags": flags})
        .eq("id", student["id"])
        .execute()
    )
    row = (updated.data or [None])[0]
    if row:
        return row
    student["profile_flags"] = flags
    return student


class BootstrapBody(BaseModel):
    full_name: str | None = None
    school: str | None = None
    class_year: Literal["first_year", "sophomore", "junior", "senior", "grad"] | None = None
    housing: Literal["on_campus", "off_campus"] | None = None
    first_gen: bool | None = None
    international: bool | None = None
    has_ssn: bool | None = None
    pell: bool | None = None
    work_study_eligible: bool | None = None


def _name_from_auth_admin(user_id: str) -> str:
    try:
        res = supabase().auth.admin.get_user_by_id(user_id)
        user = getattr(res, "user", None) or res
        blob: Any = user
        if hasattr(user, "model_dump"):
            blob = user.model_dump()
        elif hasattr(user, "dict"):
            blob = user.dict()
        if not isinstance(blob, dict):
            blob = {
                "user_metadata": getattr(user, "user_metadata", None),
                "raw_user_meta_data": getattr(user, "raw_user_meta_data", None),
            }
        meta = blob.get("user_metadata") or blob.get("raw_user_meta_data") or {}
        if isinstance(meta, dict):
            return str(meta.get("full_name") or meta.get("name") or "").strip()
    except Exception:
        pass
    return ""


def _flags_from_bootstrap(body: BootstrapBody, signup_name: str) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    if signup_name:
        updates["full_name"] = signup_name
    cleaned = {key: value for key, value in updates.items() if value not in (None, "")}
    return apply_updates({}, cleaned)


def _hydrate_identity(student: dict[str, Any], user_id: str, full_name: str | None = None) -> dict[str, Any]:
    flags = merge_profile(student.get("profile_flags"))
    name = (full_name or "").strip() or _name_from_auth_admin(user_id)
    if name and not str(flags.get("full_name") or "").strip():
        flags["full_name"] = name
        return _persist_flags(student, flags)
    if flags != (student.get("profile_flags") or {}):
        return _persist_flags(student, flags)
    return student


@router.post("/me/bootstrap")
def bootstrap(
    claims: dict[str, Any] = Depends(get_access_claims),
    body: BootstrapBody = Body(default_factory=BootstrapBody),
) -> dict[str, Any]:
    user_id = claims["id"]
    signup_name = (body.full_name or claims.get("full_name") or "").strip()
    existing = supabase().table("students").select("*").eq("user_id", user_id).limit(1).execute()
    if existing.data:
        student = existing.data[0]
        created = False
        student = _hydrate_identity(student, user_id, signup_name)
    else:
        inserted = (
            supabase()
            .table("students")
            .insert({"user_id": user_id, "profile_flags": merge_profile(_flags_from_bootstrap(body, signup_name))})
            .execute()
        )
        student = inserted.data[0]
        created = True
        student = _hydrate_identity(student, user_id, signup_name)
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
        student = provision_student(student)
    except Exception as exc:
        student["nessie_error"] = str(exc)

    return {"student": student, "state": build_student_state(student), "created": created}


@router.get("/student-state")
def student_state(claims: dict[str, Any] = Depends(get_access_claims)) -> dict[str, Any]:
    result = supabase().table("students").select("*").eq("user_id", claims["id"]).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Call POST /api/me/bootstrap first")
    student = _hydrate_identity(result.data[0], claims["id"], claims.get("full_name"))
    return build_student_state(student)


@router.get("/me/profile")
def get_profile(
    student: dict[str, Any] = Depends(get_student),
    claims: dict[str, Any] = Depends(get_access_claims),
) -> dict[str, Any]:
    student = _hydrate_identity(student, claims["id"], claims.get("full_name"))
    state = build_student_state(student)
    return {
        "profile": merge_profile(student.get("profile_flags")),
        "loan_summary": state.get("loan_summary"),
        "concepts_understood": state.get("concepts_understood") or [],
    }


@router.patch("/me/profile")
def patch_profile(body: ProfileUpdate, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    flags = apply_updates(student.get("profile_flags"), updates)
    student = _persist_flags(student, flags)
    state = build_student_state(student)
    return {
        "profile": merge_profile(student.get("profile_flags")),
        "loan_summary": state.get("loan_summary"),
        "concepts_understood": state.get("concepts_understood") or [],
    }
