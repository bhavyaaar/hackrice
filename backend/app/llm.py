from __future__ import annotations

import random
import re
import time
from pathlib import Path

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_FALLBACK_MODEL, GEMINI_MODEL

MIME_BY_SUFFIX = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class GeminiBusy(Exception):
    """Quota or rate limit after retries."""


def _config(system: str | None, max_output_tokens: int, *, thinking: bool) -> types.GenerateContentConfig:
    kwargs: dict[str, object] = {
        "system_instruction": system,
        "max_output_tokens": max_output_tokens,
    }
    if thinking:
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="MINIMAL")
    return types.GenerateContentConfig(**kwargs)


def _status_code(exc: BaseException) -> int | None:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    code = getattr(response, "status_code", None)
    return code if isinstance(code, int) else None


def _quota_is_zero(exc: BaseException) -> bool:
    text = str(exc).lower().replace(" ", "")
    return "limit:0" in text or "limit=0" in text


def _retryable(exc: BaseException) -> bool:
    if _quota_is_zero(exc):
        return False
    code = _status_code(exc)
    if code in {408, 429, 500, 502, 503, 504}:
        return True
    text = str(exc).lower()
    return any(token in text for token in ("429", "resource_exhausted", "unavailable", "overloaded"))


def _retry_seconds(exc: BaseException, attempt: int) -> float:
    match = re.search(r"retry in ([\d.]+)", str(exc), re.I)
    if match:
        return min(20.0, float(match.group(1)))
    return min(8.0, 2**attempt) + random.random()


def _models() -> list[str]:
    models = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
        models.append(GEMINI_FALLBACK_MODEL)
    return models


def _generate_content(contents: object, *, system: str | None, max_output_tokens: int) -> str:
    client = genai.Client(api_key=GEMINI_API_KEY)
    last: BaseException | None = None
    for model in _models():
        thinking = "3." in model
        for attempt in range(3):
            try:
                res = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=_config(system, max_output_tokens, thinking=thinking),
                )
                return _response_text(res)
            except Exception as exc:
                last = exc
                if _quota_is_zero(exc):
                    break
                if not _retryable(exc) or attempt == 2:
                    break
                time.sleep(_retry_seconds(exc, attempt))
    raise GeminiBusy(str(last) if last else "Gemini request failed") from last


def generate(prompt: str, *, system: str | None = None, max_output_tokens: int = 1024) -> str:
    return _generate_content(prompt, system=system, max_output_tokens=max_output_tokens)


def mime_for(path: str) -> str:
    return MIME_BY_SUFFIX.get(Path(path).suffix.lower(), "image/jpeg")


def generate_from_file(
    path: str,
    prompt: str,
    *,
    system: str | None = None,
    max_output_tokens: int = 1024,
) -> str:
    data = Path(path).read_bytes()
    return _generate_content(
        [
            types.Part.from_bytes(data=data, mime_type=mime_for(path)),
            prompt,
        ],
        system=system,
        max_output_tokens=max_output_tokens,
    )


def _response_text(res: object) -> str:
    try:
        text = getattr(res, "text", None)
        if text:
            return str(text)
    except Exception:
        pass
    try:
        candidates = getattr(res, "candidates", None) or []
        parts = getattr(getattr(candidates[0], "content", None), "parts", None) or []
        return "".join(str(getattr(part, "text", "") or "") for part in parts)
    except Exception:
        return ""
