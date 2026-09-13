from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from app.config import GEMINI_API_KEY
from app.llm import GeminiBusy, generate
from app import cloud_vision

COMPASS_DOC_SYSTEM = """You are Compass, Northstar's advisor for one college student.
You receive their checking snapshot and OCR from a financial document.
Translate the letter into what happens in THEIR bank account — not a glossary.
Rules:
- Checking balance on the snapshot is money they already have.
- Grants, Pell, scholarships, and loan refunds on the letter are NOT in checking until they post as a deposit.
- Subsidized/unsubsidized amounts are debt. They only raise checking if the school refunds leftover after tuition.
- Work-study is a future paycheck, not a lump sum they can spend today.
- A tuition bill is money leaving checking, not aid.
Name the next paycheck or refund from upcoming_inflows. Never say "runway".
Do not give generic "save this for your records" advice."""


def _profile_for_llm(student_state: dict[str, Any] | None) -> dict[str, Any]:
    if not student_state:
        return {}
    keys = (
        "balance",
        "avg_daily_spend",
        "days_until_next_disbursement",
        "next_disbursement_date",
        "upcoming_inflows",
        "next_inflow",
        "runway_shortfall_date",
        "safe_to_spend",
        "projected_balance_at_next_disbursement",
        "loan_summary",
        "concepts_understood",
        "profile_flags",
        "upcoming_bills",
        "spending_by_category",
    )
    return {key: student_state.get(key) for key in keys}


def _document_prompt(student_state: dict[str, Any] | None, ocr_text: str) -> str:
    profile = json.dumps(_profile_for_llm(student_state), default=str)
    return (
        "This student's checking snapshot (JSON):\n"
        f"{profile}\n\n"
        "OCR text from the student's document:\n"
        f"{ocr_text}\n\n"
        "Return JSON only with keys:\n"
        "document_type, headline, what_it_means, banking_story, takeaways, warnings, next_step, "
        "transcript, subsidized_loan_amount, unsubsidized_loan_amount, "
        "work_study_amount, grants_amount, total_cost_of_attendance.\n"
        "Use profile_flags (international, first_gen, has_ssn, pell, work_study_eligible, housing, splits_rent). "
        "headline: 2-6 words naming this document. "
        "what_it_means: one sentence with a dollar amount AND whether that money is already in checking. "
        "banking_story: 3-5 sentences. Cite their checking balance, bills that are already claimed, "
        "the next paycheck or refund (name and date), and what from THIS letter will or will not hit that account. "
        "takeaways: 3-4 strings, each under 22 words, tied to checking / bills / next deposit. "
        "warnings: 0-3 strings about interest, refund timing, or a shortfall. "
        "next_step: one action under 14 words. "
        "transcript is a short string of the OCR lines you used. Amounts are dollars or null. "
        "No markdown."
    )


def extract_text(path: str) -> str:
    text, _engine = ocr_document(path)
    return text


def ocr_document(path: str) -> tuple[str, str]:
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return Path(path).read_text(encoding="utf-8"), "plaintext"

    if cloud_vision.available():
        try:
            text = cloud_vision.ocr_file(path)
            if text.strip():
                return text, "cloud-vision"
        except Exception:
            pass

    if suffix == ".pdf":
        return _pdf_text(path), "pdf-text"
    return _image_text(path), "tesseract"


def _image_text(path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""
    return pytesseract.image_to_string(Image.open(path))


def _pdf_text(path: str) -> str:
    import fitz

    doc = fitz.open(path)
    chunks: list[str] = []
    for page in doc:
        native = page.get_text("text").strip()
        if len(native) >= 40:
            chunks.append(native)
            continue
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        png_path = f"{path}.p{page.number}.png"
        pix.save(png_path)
        ocr = _image_text(png_path).strip()
        chunks.append(ocr or native)
    return "\n\n".join(part for part in chunks if part)


def _parse_json(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _fallback_amounts() -> dict[str, Any]:
    return {
        "subsidized_loan_amount": 3500,
        "unsubsidized_loan_amount": 2000,
        "work_study_amount": 1500,
        "total_cost_of_attendance": 28000,
        "headline": "Award letter",
        "what_it_means": "Aid is parsed, but Compass is not live yet.",
        "takeaways": ["Compass could not reach Gemini for this scan."],
        "warnings": [],
        "next_step": "Wait a minute, then scan again.",
        "note": "Fallback parse — Gemini unavailable",
    }


def _as_string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item).strip() if item is not None else ""
        if text:
            out.append(text)
    return out


def _num(value: Any) -> float | None:
    if value is None or value is False:
        return None
    if isinstance(value, (int, float)) and value == value:
        return float(value)
    text = str(value).strip().replace("$", "").replace(",", "")
    if not text or text.lower() in {"null", "none", "n/a", "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _fmt_money(value: float) -> str:
    if abs(value - round(value)) < 0.005:
        return f"${int(round(value)):,}"
    return f"${value:,.2f}"


def _pretty_date(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        return date.fromisoformat(str(iso)[:10]).strftime("%b ") + str(date.fromisoformat(str(iso)[:10]).day)
    except ValueError:
        return str(iso)[:10]


def _bills_held(state: dict[str, Any]) -> tuple[float, list[str]]:
    nxt = state.get("next_inflow") if isinstance(state.get("next_inflow"), dict) else {}
    aid = str((nxt or {}).get("date") or state.get("next_disbursement_date") or "")[:10]
    reserved = 0.0
    names: list[str] = []
    for bill in state.get("upcoming_bills") or []:
        if not isinstance(bill, dict):
            continue
        due = str(bill.get("next_due") or "")[:10]
        if aid and due and due > aid:
            continue
        amount = _num(bill.get("amount")) or 0.0
        reserved += amount
        payee = str(bill.get("payee") or "").strip()
        if payee:
            names.append(payee)
    return reserved, names


def _banking_impact(parsed: dict[str, Any], student_state: dict[str, Any] | None) -> dict[str, Any]:
    state = student_state or {}
    balance = _num(state.get("balance")) or 0.0
    nxt = state.get("next_inflow") if isinstance(state.get("next_inflow"), dict) else {}
    nxt = nxt or {}
    days = nxt.get("days_until")
    if days is None:
        days = state.get("days_until_next_disbursement")
    try:
        days_n = int(days) if days is not None else None
    except (TypeError, ValueError):
        days_n = None
    kind = str(nxt.get("label") or "next paycheck or refund")
    when = _pretty_date(str(nxt.get("date") or state.get("next_disbursement_date") or "") or None)
    next_label = f"{kind} on {when}" if when else kind
    incoming = _num(nxt.get("amount"))
    reserved, bill_names = _bills_held(state)
    leftover = max(0.0, balance - reserved)
    today = int(leftover // max(days_n, 1)) if days_n is not None else int(leftover)

    grants = _num(parsed.get("grants_amount")) or 0.0
    sub = _num(parsed.get("subsidized_loan_amount")) or 0.0
    unsub = _num(parsed.get("unsubsidized_loan_amount")) or 0.0
    work = _num(parsed.get("work_study_amount")) or 0.0
    loans = sub + unsub
    doc_type = str(parsed.get("document_type") or "document").replace("_", " ")

    sentences: list[str] = []
    hits: list[str] = []
    sentences.append(
        f"Your checking has {_fmt_money(balance)} right now. That is already-posted money, not this {doc_type}."
    )
    if grants > 0:
        if incoming and abs(incoming - grants) / max(grants, 1) < 0.35:
            sentences.append(
                f"The {_fmt_money(grants)} in grants on this letter lines up with your {next_label}"
                + (f" ({_fmt_money(incoming)})" if incoming else "")
                + " — it is not in checking until that deposit posts."
            )
        else:
            sentences.append(
                f"The {_fmt_money(grants)} in grants on this letter is not in checking yet. Watch for it as a {kind.lower()}{f' around {when}' if when else ''}."
            )
        hits.append(f"{_fmt_money(grants)} grants → future deposit, not today's balance")
    if loans > 0:
        sentences.append(
            f"{_fmt_money(sub) if sub else '$0'} subsidized and {_fmt_money(unsub) if unsub else '$0'} unsubsidized are loans. "
            "They only hit checking if the school refunds leftover after tuition; unsubsidized starts interest while you are enrolled."
        )
        hits.append(f"{_fmt_money(loans)} loans are debt, not spendable cash")
    if work > 0:
        sentences.append(
            f"{_fmt_money(work)} work-study is earned as paychecks, not a lump you can spend today."
        )
        hits.append(f"{_fmt_money(work)} work-study arrives as wages")
    if reserved > 0:
        named = " and ".join(bill_names[:2]) if bill_names else "upcoming bills"
        sentences.append(
            f"{named} already claim {_fmt_money(reserved)} of checking before {next_label}."
        )
        hits.append(f"{_fmt_money(reserved)} already held for bills")
    if days_n is not None:
        sentences.append(
            f"Until {next_label}, that leaves about {_fmt_money(today)}/day, not the full {_fmt_money(balance)}."
        )
        hits.append(f"About {_fmt_money(today)}/day until {next_label}")
    elif not sentences:
        sentences.append("Link checking to see how this letter changes what you can spend.")

    story = parsed.get("banking_story")
    if isinstance(story, str) and len(story.strip()) > 40:
        paragraph = story.strip()
    else:
        paragraph = " ".join(sentences)

    meaning = parsed.get("what_it_means")
    if not (isinstance(meaning, str) and "checking" in meaning.lower()) and grants + loans + work > 0:
        parsed["what_it_means"] = (
            f"{_fmt_money(grants + work)} from this letter is not in your {_fmt_money(balance)} checking yet"
            + (f" — next cash is {next_label}." if when or kind else ".")
        )

    return {
        "checking": round(balance, 2),
        "bills_held": round(reserved, 2),
        "bill_names": bill_names[:3],
        "next_deposit": next_label,
        "next_deposit_amount": incoming,
        "days_until": days_n,
        "today": today,
        "paragraph": paragraph,
        "hits": hits[:4],
    }


def _with_banking(parsed: dict[str, Any], student_state: dict[str, Any] | None) -> dict[str, Any]:
    parsed["banking_impact"] = _banking_impact(parsed, student_state)
    impact = parsed["banking_impact"]
    if not parsed.get("takeaways") and impact.get("hits"):
        parsed["takeaways"] = list(impact["hits"])
    elif impact.get("hits"):
        existing = {str(item).lower() for item in parsed.get("takeaways") or []}
        for hit in impact["hits"]:
            if hit.lower() not in existing and len(parsed["takeaways"]) < 5:
                parsed["takeaways"].append(hit)
    parsed["explanation"] = _compact_explanation(parsed)
    return parsed


def _compact_explanation(parsed: dict[str, Any]) -> str:
    bits: list[str] = []
    impact = parsed.get("banking_impact")
    if isinstance(impact, dict):
        para = impact.get("paragraph")
        if isinstance(para, str) and para.strip():
            bits.append(para.strip())
    for key in ("banking_story", "what_it_means", "next_step"):
        val = parsed.get(key)
        if isinstance(val, str) and val.strip() and val.strip() not in bits:
            bits.append(val.strip())
    bits.extend(_as_string_list(parsed.get("takeaways")))
    bits.extend(_as_string_list(parsed.get("warnings")))
    legacy = parsed.get("explanation")
    if isinstance(legacy, str) and legacy.strip() and not bits:
        return legacy.strip()
    return " ".join(bits)


def interpret_award_document(path: str, student_state: dict[str, Any] | None = None) -> dict[str, Any]:
    ocr_text, engine = ocr_document(path)
    prompt = _document_prompt(student_state, ocr_text)

    if not GEMINI_API_KEY:
        result = _fallback_amounts()
        result["transcript"] = ocr_text
        result["document_type"] = "award_letter"
        result["ocr_engine"] = engine
        result["source"] = engine
        return _with_banking(result, student_state)

    try:
        parsed = _parse_json(
            generate(prompt, system=COMPASS_DOC_SYSTEM, max_output_tokens=2048)
        ) or {"raw": ocr_text}
    except GeminiBusy:
        result = _fallback_amounts()
        result["transcript"] = ocr_text
        result["document_type"] = "award_letter"
        result["ocr_engine"] = engine
        result["source"] = engine
        result["warnings"] = [
            "Gemini hit a rate limit (429). OCR is here; Compass can explain after a short wait."
        ]
        return _with_banking(result, student_state)
    parsed.setdefault("transcript", ocr_text)
    parsed["takeaways"] = _as_string_list(parsed.get("takeaways"))
    parsed["warnings"] = _as_string_list(parsed.get("warnings"))
    parsed["ocr_engine"] = engine
    parsed["source"] = f"{engine}+gemini"
    return _with_banking(parsed, student_state)
