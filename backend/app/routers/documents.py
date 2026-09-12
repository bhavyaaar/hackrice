import os
import tempfile
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile

from app.config import AWARD_LETTER_BUCKET
from app.db import supabase
from app.deps import get_student
from app.ocr import extract_text, interpret_award_letter
from app.state import build_student_state

router = APIRouter()


@router.post("/documents/scan")
async def scan_award_letter(
    file: UploadFile = File(...),
    student: dict[str, Any] = Depends(get_student),
) -> dict[str, Any]:
    suffix = os.path.splitext(file.filename or "letter.jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    ocr_text = extract_text(tmp_path)
    extracted = interpret_award_letter(ocr_text)

    storage_path = f"{student['id']}/{file.filename or 'award-letter'}"
    try:
        supabase().storage.from_(AWARD_LETTER_BUCKET).upload(
            storage_path, contents, {"content-type": file.content_type or "image/jpeg", "upsert": "true"}
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

    return {
        "document": doc,
        "ocr_text": ocr_text,
        "extracted": extracted,
        "student_state": build_student_state(student),
    }
