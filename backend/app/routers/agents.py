from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents import list_history, payoff_preview, run_agent
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


@router.get("/agents/{agent}/history")
def history(agent: str, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    if agent not in {"compass", "horizon", "anchor"}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    return {"agent": agent, "turns": list_history(student["id"], agent)}  # type: ignore[arg-type]


@router.post("/agents/horizon/simulate")
def simulate(body: HorizonSimBody, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    state = build_student_state(student)
    loan = state.get("loan_summary") or {}
    principal = float(loan.get("principal") or 0)
    rate = float(loan.get("rate") or 0)
    plan = payoff_preview(principal, rate, body.extra_monthly)
    baseline = payoff_preview(principal, rate, 0)
    interest_saved = None
    months_saved = None
    if "error" not in plan and "error" not in baseline:
        interest_saved = round(float(baseline["interest_paid"]) - float(plan["interest_paid"]), 2)
        months_saved = int(baseline["months"]) - int(plan["months"])
    supabase().table("agent_state").upsert(
        {
            "student_id": student["id"],
            "agent_name": "horizon",
            "key": "last_scenario",
            "value": {"plan": plan, "baseline": baseline, "interest_saved": interest_saved},
        },
        on_conflict="student_id,agent_name,key",
    ).execute()
    return {
        "preview": plan,
        "plan": plan,
        "baseline": baseline,
        "interest_saved": interest_saved,
        "months_saved": months_saved,
        "student_state": state,
        "as_of": date.today().isoformat(),
    }
