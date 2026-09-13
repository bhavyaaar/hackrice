# Northstar

For college students who get aid in lumps and spend in drips — and cannot tell what is already in checking vs what is still a letter.

Northstar turns a Nessie checking history plus an award-letter scan into “can I spend this before the next named deposit?” — not a generic budget app.

Nessie is the live-looking bank (Pell, scholarship, work-study, DoorDash). The scan is why the loan/grant numbers are *their* letter, not a made-up slider.

Expo talks to FastAPI; the phone never calls Gemini. Auth and data are Supabase.

## 60-second demo

1. **Sign up** — name, email, school, class year, housing. Bootstrap creates the student, a starter loan, and a Nessie demo account.
2. **Dashboard** — safe-to-spend and upcoming inflows (Pell, scholarship, work-study, loan refund) as separate dates.
3. **Advisor → Anchor** — simulate a DoorDash (or ask “Can I afford a $70 Chicago trip?”). Get go / tight / skip against cash until the next inflow.
4. **Scan** — photo, camera, or PDF of an award letter. OCR + Compass explains what hits checking vs what is debt.
5. **Finances** — extra **$50/month**. Horizon shows months and interest saved vs paying minimums.

## What it does

- **Dashboard** — safe-to-spend, upcoming inflows (Pell, scholarship, work-study, loan refund), spend mix, and campus help links
- **Scan** — camera, photo library, or PDF of an award letter; Cloud Vision OCR + Gemini extraction; saved to Supabase Storage (`award-letters`)
- **Finances** — loan snapshot and Horizon extra-payment simulation (months / interest saved)
- **Advisor** — **Anchor** (impulse check + simulate purchase) and **Compass** (one concept at a time)
- **Profile** — housing, first-gen / international / Pell / work-study flags that change agent advice

Signup/login is email + password via Supabase Auth. First authenticated call is `POST /api/me/bootstrap`, which creates the student row, a starter loan, and a Nessie demo account.

## Architecture

```
mobile (Expo)  --Bearer JWT-->  FastAPI  -->  Gemini, Cloud Vision, Nessie
                                    |
                                    v
                               Supabase (Postgres + Storage)
```

Once uvicorn is running, the route list is at `http://localhost:8000/docs`.

Agents:

| Agent | Role | Used from |
| --- | --- | --- |
| Anchor | Go / tight / skip on a purchase vs cash until the next named inflow | Advisor, simulate-purchase |
| Horizon | Cash until next paycheck/refund; extra monthly payment preview | Finances |
| Compass | One aid/loan concept, plus award-letter explanation | Advisor, Scan |

## Run locally

You need two processes: FastAPI on port 8000 and Expo from `mobile/`. There is no local database — Postgres and Auth stay on a free Supabase project. Gemini, Cloud Vision, and Nessie are remote APIs.

### Prerequisites

- Python 3.11+ (3.12 is fine)
- Node 20+ and npm
- Expo Go on a phone, **or** Xcode Simulator / Android emulator
- Accounts / keys:
  - [Supabase](https://supabase.com) project
  - [Google AI Studio](https://aistudio.google.com/apikey) Gemini key
  - [Nessie](https://api.nessieisreal.com) API key
  - Google Cloud API key with **Cloud Vision API** enabled (scan); without it, OCR falls back to PDF text / Tesseract if installed

### 1. Clone and env files

```bash
git clone https://github.com/bhavyaaar/hackrice.git
cd hackrice
cp .env.example .env
cp mobile/.env.example mobile/.env
```

Fill **repo-root** `.env` (loaded by FastAPI from the repo root or `backend/.env`):

| Variable | Where to get it |
| --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` (server only, never put this in the app) |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret |
| `NESSIE_API_KEY` | Nessie dashboard |
| `GEMINI_API_KEY` | Google AI Studio |
| `GOOGLE_VISION_API_KEY` | GCP → APIs & Services → Credentials; enable Cloud Vision API |

Optional: `GEMINI_MODEL` (default `gemini-3.6-flash`), `GEMINI_FALLBACK_MODEL`, `DISBURSEMENT_MULTIPLIER`.

Fill **`mobile/.env`**:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=<same as SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same as SUPABASE_ANON_KEY>
```

On a **physical phone**, `localhost` is the phone, not your laptop. Either:

- put your laptop LAN IP in `EXPO_PUBLIC_API_URL` (example: `http://192.168.1.12:8000`), or
- leave `localhost` and join the same Wi‑Fi / iPhone hotspot — the app rewrites `localhost` to the Metro packager host when it can.

Restart Expo after changing `mobile/.env` (`npx expo start --clear`).

### 2. Supabase project (once)

1. Create a project.
2. **Authentication → Providers → Email**: enable email. For local demos, turn **off** “Confirm email” so signup can sign in immediately. If confirm is on, open the email link before logging in.
3. SQL editor → paste and run `backend/sql/schema.sql`.
4. Storage → New bucket named `award-letters`, **public**.

### 3. Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` lets a phone on the LAN hit the API. Check `http://localhost:8000/health` — you should see `{"ok":"northstar"}`.

You do **not** have to run seed. First signup calls `POST /api/me/bootstrap`, which creates the student, a starter loan, and a Nessie demo account (Pell, scholarship, work-study, spend). If Nessie was empty when you first signed up, set the key and run:

```bash
cd backend && source .venv/bin/activate && python -m app.seed
```

### 4. Mobile (terminal 2)

```bash
cd mobile
npm install
npx expo start --clear
```

Always start Expo from `mobile/`. Running `npx expo` from the repo root makes Metro look in the wrong `node_modules` (or downloads Expo via npx) and shows `expo-asset could not be found`.

Then:

- press `i` for iOS Simulator, `a` for Android emulator, or
- scan the QR code with **Expo Go** (same Wi‑Fi as the laptop).

If the phone cannot load the bundle (different network / campus Wi‑Fi client isolation), from `mobile/`:

```bash
npm run iphone
```

That starts Expo with a tunnel. The API still needs a reachable `EXPO_PUBLIC_API_URL` (LAN IP + uvicorn on `0.0.0.0`, or a tunnel to port 8000). The Metro tunnel does not proxy FastAPI.

### 5. First run in the app

1. Create an account (name, email, password, school, class year, housing).
2. Dashboard should load a checking snapshot and upcoming inflows.
3. Scan can use a photo, the camera, or a PDF; `backend/sample_data/award_letter.txt` is a text fixture if you want to skip OCR while testing the rest of the pipeline.

### Local troubleshooting

| Symptom | Fix |
| --- | --- |
| `Can't reach the API at http://…` | Backend running? `--host 0.0.0.0`? Phone on same network? LAN IP in `EXPO_PUBLIC_API_URL`? macOS firewall allowing Python? |
| `expo-asset could not be found` | `cd mobile` then `npx expo start --clear` |
| Signup works but no session | Disable email confirmation in Supabase, or confirm the email |
| Dashboard empty / no Nessie | `NESSIE_API_KEY` in root `.env`, restart uvicorn, sign up again or `python -m app.seed` |
| Agents error | `GEMINI_API_KEY` set; restart uvicorn |
| Scan returns almost no text | Vision key + API enabled; otherwise install Tesseract for the image fallback |
| Env changes ignored | Restart uvicorn; for Expo, `--clear` and rebuild after `mobile/.env` edits |

## Repo

```
backend/app/          FastAPI, agents, OCR, Nessie
backend/sql/schema.sql
mobile/app/            Expo Router screens
mobile/src/lib/        API client, auth, dashboard math
.env.example           Backend + shared keys
mobile/.env.example    Expo public keys
```
