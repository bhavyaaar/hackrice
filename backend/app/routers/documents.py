import os
import tempfile
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import AWARD_LETTER_BUCKET
from app.db import supabase
from app.deps import get_student
from app.ocr import interpret_award_document
from app.state import build_student_state

router = APIRouter()


def _suffix(file: UploadFile) -> str:
    name = file.filename or ""
    ext = os.path.splitext(name)[1]
    if ext:
        return ext
    ctype = (file.content_type or "").lower()
    if "pdf" in ctype:
        return ".pdf"
    if "png" in ctype:
        return ".png"
    return ".jpg"


@router.post("/documents/scan")
async def scan_award_letter(
    file: UploadFile = File(...),
    student: dict[str, Any] = Depends(get_student),
) -> dict[str, Any]:
    suffix = _suffix(file)
    if suffix.lower() not in {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff", ".bmp"}:
        raise HTTPException(status_code=400, detail="Upload a PDF or an image of the award letter")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    state = build_student_state(student)
    extracted = interpret_award_document(tmp_path, student_state=state)
    ocr_text = str(extracted.get("transcript") or "")

    filename = file.filename or f"award-letter{suffix}"
    storage_path = f"{student['id']}/{filename}"
    content_type = file.content_type or ("application/pdf" if suffix.lower() == ".pdf" else "image/jpeg")
    try:
        supabase().storage.from_(AWARD_LETTER_BUCKET).upload(
            storage_path, contents, {"content-type": content_type, "upsert": "true"}
        )
    except Exception:
        storage_path = f"local:{tmp_path}"

    doc = (
        supabase()
        .table("documents")
        .insert(
            {
                "student_id": student["id"],
                "storage_path": storage_path,
                "ocr_text": ocr_text,
                "extracted_json": extracted,
            }
        )
        .execute()
        .data[0]
    )

    if extracted.get("subsidized_loan_amount") or extracted.get("unsubsidized_loan_amount"):
        sub = float(extracted.get("subsidized_loan_amount") or 0)
        unsub = float(extracted.get("unsubsidized_loan_amount") or 0)
        supabase().table("loans").insert(
            {
                "student_id": student["id"],
                "principal": sub + unsub,
                "subsidized_amount": sub,
                "unsubsidized_amount": unsub,
                "interest_rate": 0.055,
            }
        ).execute()

    explanation = extracted.get("explanation")
    if explanation:
        supabase().table("agent_state").upsert(
            {
                "student_id": student["id"],
                "agent_name": "compass",
                "key": "last_reply",
                "value": {"message": "document_scan", "reply": explanation, "document_type": extracted.get("document_type")},
            },
            on_conflict="student_id,agent_name,key",
        ).execute()
        if "subsidized" in str(explanation).lower():
            supabase().table("concepts_understood").upsert(
                {"student_id": student["id"], "concept_name": "subsidized_vs_unsubsidized"},
                on_conflict="student_id,concept_name",
            ).execute()

    return {
        "document": doc,
        "ocr_text": ocr_text,
        "extracted": extracted,
        "explanation": explanation,
        "student_state": build_student_state(student),
    }
