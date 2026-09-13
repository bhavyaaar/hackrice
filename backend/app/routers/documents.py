import json
import os
import tempfile
import time
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import AWARD_LETTER_BUCKET
from app.db import supabase
from app.deps import get_student
from app.ocr import interpret_award_document
from app.state import build_student_state

router = APIRouter()


class SaveDocumentBody(BaseModel):
    storage_path: str
    ocr_text: str = ""
    extracted: dict[str, Any] = Field(default_factory=dict)


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


def _money(value: Any) -> float:
    if value is None or value is False:
        return 0.0
    if isinstance(value, (int, float)) and value == value:
        return float(value)
    text = str(value).strip().replace("$", "").replace(",", "")
    if not text or text.lower() in {"null", "none", "n/a", "-"}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _jsonable(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _save_document(student: dict[str, Any], storage_path: str, ocr_text: str, extracted: dict[str, Any]) -> dict[str, Any]:
    payload = _jsonable(extracted) if isinstance(extracted, dict) else {}
    try:
        result = (
            supabase()
            .table("documents")
            .insert(
                {
                    "student_id": student["id"],
                    "storage_path": storage_path,
                    "ocr_text": ocr_text or "",
                    "extracted_json": payload,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save document: {exc}") from exc

    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Supabase accepted the save but returned no document row")
    doc = rows[0]

    sub = _money(payload.get("subsidized_loan_amount"))
    unsub = _money(payload.get("unsubsidized_loan_amount"))
    if sub or unsub:
        try:
            supabase().table("loans").insert(
                {
                    "student_id": student["id"],
                    "principal": sub + unsub,
                    "subsidized_amount": sub,
                    "unsubsidized_amount": unsub,
                    "interest_rate": 0.055,
                }
            ).execute()
        except Exception:
            pass

    return doc


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

    try:
        state = build_student_state(student)
    except Exception:
        state = None
    try:
        extracted = interpret_award_document(tmp_path, student_state=state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}") from exc
    extracted = _jsonable(extracted) if isinstance(extracted, dict) else {}
    ocr_text = str(extracted.get("transcript") or "")

    filename = file.filename or f"award-letter{suffix}"
    storage_path = f"{student['id']}/{int(time.time())}-{filename}"
    content_type = file.content_type or ("application/pdf" if suffix.lower() == ".pdf" else "image/jpeg")
    try:
        supabase().storage.from_(AWARD_LETTER_BUCKET).upload(
            storage_path, contents, {"content-type": content_type, "upsert": "true"}
        )
    except Exception:
        storage_path = f"local:{tmp_path}"

    explanation = extracted.get("explanation")
    if explanation:
        try:
            supabase().table("agent_state").upsert(
                {
                    "student_id": student["id"],
                    "agent_name": "compass",
                    "key": "last_reply",
                    "value": {
                        "message": "document_scan",
                        "reply": explanation,
                        "document_type": extracted.get("document_type"),
                    },
                },
                on_conflict="student_id,agent_name,key",
            ).execute()
            if "subsidized" in str(explanation).lower():
                supabase().table("concepts_understood").upsert(
                    {"student_id": student["id"], "concept_name": "subsidized_vs_unsubsidized"},
                    on_conflict="student_id,concept_name",
                ).execute()
        except Exception:
            pass

    return {
        "storage_path": storage_path,
        "ocr_text": ocr_text,
        "extracted": extracted,
        "explanation": explanation,
        "saved": False,
    }


@router.post("/documents/save")
def save_document(body: SaveDocumentBody, student: dict[str, Any] = Depends(get_student)) -> dict[str, Any]:
    if not body.storage_path.strip():
        raise HTTPException(status_code=400, detail="Missing storage path")
    doc = _save_document(student, body.storage_path.strip(), body.ocr_text, body.extracted)
    return {"document": doc, "saved": True}


@router.get("/documents")
def list_documents(student: dict[str, Any] = Depends(get_student)) -> list[dict[str, Any]]:
    try:
        result = (
            supabase()
            .table("documents")
            .select("*")
            .eq("student_id", student["id"])
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load documents: {exc}") from exc
    return result.data or []
