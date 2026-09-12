from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents import run_agent, payoff_preview
from app.db import supabase
from app.deps import get_student
from app.state import build_student_state

router = APIRouter()


class ChatBody(BaseModel):
    message: str


class HorizonSimBody(BaseModel):
    extra_monthly: float


@router.post("/agents/{agent}/chat")
def chat(agent: str, body: ChatBody, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    if agent not in {"compass", "horizon", "anchor"}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    state = build_student_state(student)
    return run_agent(agent, student, state, body.message)  # type: ignore[arg-type]


@router.post("/agents/horizon/simulate")
def simulate(body: HorizonSimBody, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    state = build_student_state(student)
    loan = state.get("loan_summary") or {}
    preview = payoff_preview(float(loan.get("principal") or 0), float(loan.get("rate") or 0), body.extra_monthly)
    supabase().table("agent_state").upsert(
        {
            "student_id": student["id"],
            "agent_name": "horizon",
            "key": "last_scenario",
            "value": preview,
        },
        on_conflict="student_id,agent_name,key",
    ).execute()
    return {"preview": preview, "student_state": state, "as_of": date.today().isoformat()}
