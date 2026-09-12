from __future__ import annotations

import base64
from pathlib import Path

import httpx

from app.config import GOOGLE_VISION_API_KEY

VISION_ANNOTATE = "https://vision.googleapis.com/v1/images:annotate"


def available() -> bool:
    return bool(GOOGLE_VISION_API_KEY)


def ocr_file(path: str) -> str:
    images = _pages_as_png(path)
    if not images:
        return ""
    requests = [
        {
            "image": {"content": base64.b64encode(png).decode("ascii")},
            "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
        }
        for png in images
    ]
    with httpx.Client(timeout=60) as client:
        res = client.post(
            VISION_ANNOTATE,
            headers={
                "x-goog-api-key": GOOGLE_VISION_API_KEY,
                "Content-Type": "application/json",
            },
            json={"requests": requests},
        )
        res.raise_for_status()
        payload = res.json()
    chunks: list[str] = []
    for item in payload.get("responses") or []:
        err = item.get("error")
        if err:
            raise RuntimeError(err.get("message") or "Cloud Vision error")
        text = (item.get("fullTextAnnotation") or {}).get("text") or ""
        if text.strip():
            chunks.append(text.strip())
    return "\n\n".join(chunks)


def _pages_as_png(path: str) -> list[bytes]:
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        import fitz

        doc = fitz.open(path)
        return [page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png") for page in doc]
    data = Path(path).read_bytes()
    if suffix in {".png"}:
        return [data]
    try:
        from io import BytesIO

        from PIL import Image

        image = Image.open(BytesIO(data))
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        out = BytesIO()
        image.save(out, format="PNG")
        return [out.getvalue()]
    except Exception:
        return [data]
