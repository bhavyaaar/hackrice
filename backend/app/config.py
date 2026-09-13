import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

NESSIE_BASE = os.getenv("NESSIE_BASE", "https://api.nessieisreal.com").rstrip("/")
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-latest").strip()
GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "").strip()
DISBURSEMENT_MULTIPLIER = float(os.getenv("DISBURSEMENT_MULTIPLIER", "2.5"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip()
AWARD_LETTER_BUCKET = os.getenv("AWARD_LETTER_BUCKET", "award-letters")
