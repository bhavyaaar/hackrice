from __future__ import annotations

import json
from typing import Any, Literal

from app.config import ANTHROPIC_API_KEY
from app.db import supabase

AgentName = Literal["compass", "horizon", "anchor"]

PROMPTS: dict[AgentName, str] = {
    "anchor": """You are Anchor, Northstar's impulse-check agent for college students.
You only reason from the provided student-state JSON and the user's message.
Be specific and numeric. Compare a purchase or ask against runway_shortfall_date and avg_daily_spend.
Never give generic "you're overspending" advice. Mention days and dollar amounts.
Keep replies under 120 words.""",
    "horizon": """You are Horizon, Northstar's future-planning agent.
Use student-state and loan_summary. Explain runway in plain language.
If they explore extra monthly payments, estimate a new payoff horizon and interest saved with simple amortization.
Keep replies under 150 words.""",
    "compass": """You are Compass, Northstar's advisor.
Pick ONE concept to explain based on profile_flags, loan_summary, and concepts_understood.
Prefer subsidized vs unsubsidized, disbursement cadence, or interest-while-in-school.
After explaining, say clearly which concept they now understand.
Keep replies under 150 words. Do not dump a textbook.""",
}


def _write_state(student_id: str, agent: AgentName, key: str, value: Any) -> None:
    supabase().table("agent_state").upsert(
        {
            "student_id": student_id,
            "agent_name": agent,
            "key": key,
            "value": value,
        },
        on_conflict="student_id,agent_name,key",
    ).execute()


def _mark_concept(student_id: str, concept_name: str) -> None:
    supabase().table("concepts_understood").upsert(
        {"student_id": student_id, "concept_name": concept_name},
        on_conflict="student_id,concept_name",
    ).execute()


def _claude(agent: AgentName, student_state: dict[str, Any], message: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    res = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=400,
        system=PROMPTS[agent],
        messages=[
            {
                "role": "user",
                "content": f"student-state:\n{json.dumps(student_state, default=str)}\n\nUser: {message}",
            }
        ],
    )
    return res.content[0].text


def _fallback(agent: AgentName, student_state: dict[str, Any], message: str) -> str:
    shortfall = student_state.get("runway_shortfall_date") or "not projected"
    days = student_state.get("days_until_next_disbursement")
    balance = student_state.get("balance")
    avg = student_state.get("avg_daily_spend")
    loan = student_state.get("loan_summary") or {}
    if agent == "anchor":
        return (
            f"You have ${balance} now, spending about ${avg}/day. "
            f"Next aid is in {days} days; shortfall date is {shortfall}. "
            f"I compared your question (“{message}”) against that runway, not a flat budget."
        )
    if agent == "horizon":
        return (
            f"Runway: ${balance} vs ${avg}/day until the next disbursement ({days} days). "
            f"Loan principal ${loan.get('principal')} at {loan.get('rate')}. "
            f"Tell me an extra monthly amount and I’ll estimate payoff and interest saved."
        )
    understood = student_state.get("concepts_understood") or []
    if "subsidized_vs_unsubsidized" not in understood:
        return (
            "Your package has subsidized and unsubsidized loans. Subsidized does not accrue interest "
            "while you’re in school; unsubsidized is accruing now. That’s the first concept to lock in."
        )
    return "You’re current on the core loan concepts. Ask about disbursement timing or extra payments next."


def run_agent(agent: AgentName, student: dict[str, Any], student_state: dict[str, Any], message: str) -> dict[str, Any]:
    text = _claude(agent, student_state, message) if ANTHROPIC_API_KEY else _fallback(agent, student_state, message)
    _write_state(student["id"], agent, "last_reply", {"message": message, "reply": text})
    if agent == "compass" and "subsidized" in text.lower():
        _mark_concept(student["id"], "subsidized_vs_unsubsidized")
    if agent == "horizon":
        _write_state(student["id"], "horizon", "last_scenario", {"prompt": message})
    return {"agent": agent, "reply": text, "student_state": student_state}


def payoff_preview(principal: float, rate: float, extra_monthly: float, years: int = 10) -> dict[str, Any]:
    r = rate / 12
    n = years * 12
    if r == 0:
        base = principal / n
    else:
        base = principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
    payment = base + extra_monthly
    if payment <= r * principal:
        return {"error": "Payment too small to amortize"}
    bal = principal
    months = 0
    interest = 0.0
    while bal > 0.01 and months < 600:
        interest_chunk = bal * r
        interest += interest_chunk
        principal_chunk = payment - interest_chunk
        bal = max(bal - principal_chunk, 0)
        months += 1
    base_interest = principal * r * n  # rough baseline for extra=0 over full term
    return {
        "extra_monthly": extra_monthly,
        "monthly_payment": round(payment, 2),
        "months": months,
        "interest_paid": round(interest, 2),
        "baseline_interest_est": round(base_interest, 2),
    }
