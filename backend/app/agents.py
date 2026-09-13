from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from app.config import GEMINI_API_KEY
from app.db import supabase
from app.llm import GeminiBusy, generate

AgentName = Literal["compass", "horizon", "anchor"]

PROMPTS: dict[AgentName, str] = {
    "anchor": """You are Anchor, Northstar's impulse-check agent for college students.
You only reason from the provided student-state JSON and the user's message.
Be specific and numeric. Compare a purchase against cash until the soonest upcoming_inflows date (work-study, scholarship, Pell, or loan refund — not one generic aid date).
If profile_flags.anchor_nags_doordash is true, be stricter on food-delivery spend.
If safe_to_spend_style is strict, treat the whole safe-to-spend number as the cap; if buffer_20, they already left ~$20/week of slack.
Never give generic "you're overspending" advice. Mention days and dollar amounts.
Never say "runway". Name the next inflow (work-study paycheck, Pell, scholarship, loan refund).
Return JSON only, no markdown, with keys:
verdict (go, stretch, or skip),
headline (2-6 words),
why (one sentence, under 18 words, with a dollar amount),
extra_after (number of dollars left after this buy, or null),
days_to_aid (integer or null),
takeaways (2-3 strings, each under 12 words),
watch (0-2 strings about shortfall or food delivery),
next_step (one action under 12 words).
go = they still make the next inflow with slack. stretch = they make it with almost no extra. skip = this buy causes a shortfall or blows safe-to-spend.""",
    "horizon": """You are Horizon, Northstar's future-planning agent.
Use student-state, loan_summary, and upcoming_inflows. Explain cash until the next paycheck or refund in plain language.
Never say "runway".
If they explore extra monthly payments, estimate a new payoff horizon and interest saved with simple amortization.
If housing is off_campus or splits_rent, keep rent in the plan. If on_campus, talk meal plan vs cash.
Keep replies under 150 words.""",
    "compass": """You are Compass, Northstar's advisor.
Pick ONE concept to explain based on profile_flags, loan_summary, and concepts_understood.
Read first_gen, international, has_ssn, pell, work_study_eligible, housing, class_year, splits_rent.
If international or has_ssn is false, do not assume work-study or typical US aid.
If pell is true, treat refunds as timed aid, not free spending money.
Prefer subsidized vs unsubsidized, multiple inflow schedules, or interest-while-in-school.
After explaining, say clearly which concept they now understand.
Never say "runway". Work-study, scholarships, Pell, and loan refunds are different dates — do not collapse them into one "next aid".
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


HISTORY_CAP = 40


def _read_state(student_id: str, agent: AgentName, key: str) -> Any:
    result = (
        supabase()
        .table("agent_state")
        .select("value")
        .eq("student_id", student_id)
        .eq("agent_name", agent)
        .eq("key", key)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0]["value"] if rows else None


def _history_turns(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [row for row in raw if isinstance(row, dict)]
    if isinstance(raw, dict) and isinstance(raw.get("turns"), list):
        return [row for row in raw["turns"] if isinstance(row, dict)]
    return []


def list_history(student_id: str, agent: AgentName) -> list[dict[str, Any]]:
    return _history_turns(_read_state(student_id, agent, "chat_history"))


def _append_history(
    student_id: str,
    agent: AgentName,
    message: str,
    reply: str,
    card: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    turns = list_history(student_id, agent)
    if not turns:
        last = _read_state(student_id, agent, "last_reply")
        if isinstance(last, dict) and (last.get("message") or last.get("reply")):
            turns.append(
                {
                    "id": str(uuid4()),
                    "at": datetime.now(timezone.utc).isoformat(),
                    "message": last.get("message") or "",
                    "reply": last.get("reply") or "",
                    "card": last.get("card"),
                }
            )
    turn = {
        "id": str(uuid4()),
        "at": datetime.now(timezone.utc).isoformat(),
        "message": message,
        "reply": reply,
        "card": card,
    }
    if turns and turns[-1].get("message") == message and turns[-1].get("reply") == reply:
        return turns[-HISTORY_CAP:]
    turns.append(turn)
    turns = turns[-HISTORY_CAP:]
    _write_state(student_id, agent, "chat_history", turns)
    return turns
    supabase().table("concepts_understood").upsert(
        {"student_id": student_id, "concept_name": concept_name},
        on_conflict="student_id,concept_name",
    ).execute()


def _as_string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _parse_json_object(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _anchor_card(raw: dict[str, Any], student_state: dict[str, Any]) -> dict[str, Any]:
    verdict = str(raw.get("verdict") or "stretch").lower()
    if verdict not in {"go", "stretch", "skip"}:
        verdict = "stretch"
    extra = raw.get("extra_after")
    try:
        extra_n = None if extra in (None, "") else round(float(extra), 2)
    except (TypeError, ValueError):
        extra_n = None
    days = raw.get("days_to_aid")
    if days in (None, ""):
        days = student_state.get("days_until_next_disbursement")
    try:
        days_n = None if days in (None, "") else int(days)
    except (TypeError, ValueError):
        days_n = None
    return {
        "verdict": verdict,
        "headline": str(raw.get("headline") or "Impulse check").strip(),
        "why": str(raw.get("why") or "").strip(),
        "extra_after": extra_n,
        "days_to_aid": days_n,
        "takeaways": _as_string_list(raw.get("takeaways")),
        "watch": _as_string_list(raw.get("watch")),
        "next_step": str(raw.get("next_step") or "").strip(),
    }


def _card_reply(card: dict[str, Any]) -> str:
    bits = [card.get("headline") or "", card.get("why") or "", card.get("next_step") or ""]
    bits.extend(card.get("takeaways") or [])
    bits.extend(card.get("watch") or [])
    return " ".join(str(bit).strip() for bit in bits if str(bit).strip())


def _gemini(agent: AgentName, student_state: dict[str, Any], message: str) -> str:
    return generate(
        f"student-state:\n{json.dumps(student_state, default=str)}\n\nUser: {message}",
        system=PROMPTS[agent],
    )


def _fallback(agent: AgentName, student_state: dict[str, Any], message: str) -> str:
    shortfall = student_state.get("runway_shortfall_date") or "not projected"
    days = student_state.get("days_until_next_disbursement")
    balance = student_state.get("balance")
    avg = student_state.get("avg_daily_spend")
    extra = student_state.get("safe_to_spend")
    loan = student_state.get("loan_summary") or {}
    if agent == "anchor":
        return json.dumps(
            {
                "verdict": "skip" if student_state.get("runway_shortfall_date") else "stretch",
                "headline": "Cash until next inflow",
                "why": f"${balance} in checking, about ${avg}/day.",
                "extra_after": extra,
                "days_to_aid": days,
                "takeaways": [f"Next aid in {days} days.", f"Compared against “{message[:48]}”."],
                "watch": [f"Shortfall {shortfall}."] if student_state.get("runway_shortfall_date") else [],
                "next_step": "Ask again with a dollar amount.",
            }
        )
    if agent == "horizon":
        return (
            f"Cash until next inflow: ${balance} vs ${avg}/day until the next paycheck or refund ({days} days). "
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
    if GEMINI_API_KEY:
        try:
            text = _gemini(agent, student_state, message)
        except GeminiBusy:
            text = _fallback(agent, student_state, message)
    else:
        text = _fallback(agent, student_state, message)

    card = None
    if agent == "anchor":
        parsed = _parse_json_object(text)
        if parsed:
            card = _anchor_card(parsed, student_state)
            text = _card_reply(card)

    _write_state(student["id"], agent, "last_reply", {"message": message, "reply": text, "card": card})
    history = _append_history(student["id"], agent, message, text, card)
    if agent == "compass" and "subsidized" in text.lower():
        _mark_concept(student["id"], "subsidized_vs_unsubsidized")
    if agent == "horizon":
        _write_state(student["id"], "horizon", "last_scenario", {"prompt": message})
    return {"agent": agent, "reply": text, "card": card, "history": history, "student_state": student_state}


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
    base_interest = principal * r * n
    return {
        "extra_monthly": extra_monthly,
        "monthly_payment": round(payment, 2),
        "months": months,
        "interest_paid": round(interest, 2),
        "baseline_interest_est": round(base_interest, 2),
    }
