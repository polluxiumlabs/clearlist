# Clearlist

Clearlist is a privacy-first email list cleaner. CSV parsing, normalization,
deduplication, filtering, and export happen in the browser. The FastAPI service
checks addresses in small batches and keeps only short-lived in-memory caches.

There is no database, Redis, task queue, account system, or server-side file
storage.

## Run locally

### Frontend

```powershell
npm install
npm run dev
```

The app opens at `http://localhost:3000` and expects the verifier at
`http://localhost:8000`. Set `NEXT_PUBLIC_API_URL` before building if the API is
hosted elsewhere.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000 --no-access-log
```

Copy `backend/.env.example` values into your environment to tune batch size,
timeouts, cache lifetime, and CORS.

SMTP probing and catch-all checks are disabled by default because many hosting
providers block outbound port 25 and many receiving servers deliberately hide
mailbox status. Enable `SMTP_ENABLED=true` only on infrastructure that permits
responsible SMTP verification. Enable `CATCH_ALL_ENABLED=true` separately.

With SMTP disabled, an address with good syntax and MX records is returned as
`UNKNOWN`, not incorrectly labeled valid.

## CSV format

Clearlist detects common header variants. The only required column is `Email`.
The cleaned download contains exactly:

```csv
Name,Title,Organization,Email
```

## API

`POST /api/verify-batch`

```json
{
  "emails": ["person@example.com"]
}
```

The maximum batch size is 500 by default. Syntax failures and missing domains
short-circuit before later checks. DNS and catch-all facts are cached only in
process memory and disappear when the server restarts.

## Verify the build

```powershell
npm run build

cd backend
pip install -r requirements-dev.txt
pytest
```
