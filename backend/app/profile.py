from __future__ import annotations

from typing import Any

PROFILE_DEFAULTS: dict[str, Any] = {
    "full_name": "",
    "school": "",
    "class_year": "",
    "graduation_year": "",
    "housing": "",
    "first_gen": True,
    "international": False,
    "has_ssn": True,
    "pell": False,
    "work_study_eligible": True,
    "safe_to_spend_style": "strict",
    "notify_bills": True,
    "notify_aid": True,
    "anchor_nags_doordash": True,
    "splits_rent": False,
    "handled_bills": [],
}

PROFILE_KEYS = tuple(PROFILE_DEFAULTS.keys())


def merge_profile(flags: Any) -> dict[str, Any]:
    incoming = flags if isinstance(flags, dict) else {}
    merged = {**PROFILE_DEFAULTS, **incoming}
    bills = merged.get("handled_bills") or []
    if not isinstance(bills, list):
        bills = []
    merged["handled_bills"] = [str(item) for item in bills if str(item).strip()]
    return {key: merged[key] for key in PROFILE_KEYS}


def apply_updates(current: Any, updates: dict[str, Any]) -> dict[str, Any]:
    merged = merge_profile(current)
    for key, value in updates.items():
        if key in PROFILE_DEFAULTS and value is not None:
            merged[key] = value
    return merged
