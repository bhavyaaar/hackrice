from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.config import SUPABASE_JWT_SECRET, SUPABASE_URL
from app.db import supabase


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is not set")
    return PyJWKClient(f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json")


def _decode_access_token(token: str) -> dict[str, Any]:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        if not SUPABASE_JWT_SECRET:
            raise
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )


def get_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = _decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub")
    return user_id


def get_student(user_id: str = Depends(get_user_id)) -> dict[str, Any]:
    result = supabase().table("students").select("*").eq("user_id", user_id).limit(1).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Student profile not bootstrapped")
    return rows[0]
