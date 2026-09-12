from __future__ import annotations

from pathlib import Path

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_MODEL

MIME_BY_SUFFIX = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _config(system: str | None, max_output_tokens: int) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=max_output_tokens,
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
    )


def generate(prompt: str, *, system: str | None = None, max_output_tokens: int = 1024) -> str:
    client = genai.Client(api_key=GEMINI_API_KEY)
    res = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=_config(system, max_output_tokens),
    )
    return res.text or ""


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
    client = genai.Client(api_key=GEMINI_API_KEY)
    res = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=data, mime_type=mime_for(path)),
            prompt,
        ],
        config=_config(system, max_output_tokens),
    )
    return res.text or ""
