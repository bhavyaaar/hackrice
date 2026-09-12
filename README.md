# Northstar

Student financial runway coach. Expo app + FastAPI + Nessie + Supabase Auth.


## 1. Supabase

Create a project, then run `backend/supabase/schema.sql` in the SQL editor.

Create a public Storage bucket named `award-letters`.

Copy `.env.example` → `.env` and fill keys. JWT secret is in Project Settings → API.

## 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional: `python -m app.seed` after Nessie key is set (creates the demo customer/account).

## 3. Mobile

```bash
cd mobile
cp .env.example .env
# set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
# EXPO_PUBLIC_API_URL=http://localhost:8000  (use your LAN IP on a physical phone)
npx expo start --clear
```

Start Expo from `mobile/` only. Running `npx expo` from the hackrice repo root makes Metro look in the wrong `node_modules` (or downloads Expo 57 via npx), which surfaces as `expo-asset could not be found` in FontLoader.

Tabs: Dashboard · Scan · Finances · Advisor · Profile.

## Agents

The phone never talks to Claude. FastAPI loads `/api/student-state`, then:

- `POST /api/agents/anchor/chat` — Plan tab + after simulate-purchase
- `POST /api/agents/horizon/chat` and `/api/agents/horizon/simulate` — Learn
- `POST /api/agents/compass/chat` — Learn
- `POST /api/documents/scan` — Learn → Scan
