from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import GEMINI_API_KEY
from app.llm import generate
from app import cloud_vision

COMPASS_DOC_SYSTEM = """You are Compass, Northstar's advisor for one college student.
You receive their student-state JSON and OCR text from a financial document.
Identify the document type (award letter, tuition bill, 1098-T, 1098-E, W-2, MPN, refund/direct-deposit form, FERPA waiver, or other).
Explain how THIS document fits THEIR runway, loans, disbursement timing, and next decision.
Use their balance, avg_daily_spend, days_until_next_disbursement, loan_summary, and profile_flags.
Be numeric. Do not give generic "save this for your records" advice. Under 180 words."""


def _profile_for_llm(student_state: dict[str, Any] | None) -> dict[str, Any]:
    if not student_state:
        return {}
    keys = (
        "balance",
        "avg_daily_spend",
        "days_until_next_disbursement",
        "next_disbursement_date",
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
        "student-state JSON (this specific student):\n"
        f"{profile}\n\n"
        "OCR text from the student's document:\n"
        f"{ocr_text}\n\n"
        "Return JSON only with keys:\n"
        "document_type, transcript, subsidized_loan_amount, unsubsidized_loan_amount, "
        "work_study_amount, grants_amount, total_cost_of_attendance, explanation.\n"
        "transcript is a short string of the OCR lines you used. Amounts are dollars or null. "
        "explanation is how this document changes THIS student's financial journey. No markdown."
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
        "note": "Fallback parse — set GEMINI_API_KEY for live extraction",
    }


def interpret_award_document(path: str, student_state: dict[str, Any] | None = None) -> dict[str, Any]:
    ocr_text, engine = ocr_document(path)
    prompt = _document_prompt(student_state, ocr_text)

    if not GEMINI_API_KEY:
        result = _fallback_amounts()
        result["transcript"] = ocr_text
        result["document_type"] = "award_letter"
        result["ocr_engine"] = engine
        result["source"] = engine
        result["explanation"] = (
            "OCR ran, but Gemini is not configured to explain this against your runway. "
            "Set GEMINI_API_KEY for Compass."
        )
        return result

    parsed = _parse_json(
        generate(prompt, system=COMPASS_DOC_SYSTEM, max_output_tokens=1536)
    ) or {"raw": ocr_text}
    parsed.setdefault("transcript", ocr_text)
    parsed["ocr_engine"] = engine
    parsed["source"] = f"{engine}+gemini"
    return parsed
