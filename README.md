# Clearlist

Clearlist combines a browser-based CSV cleaner with a FastAPI email-verification service. It reports syntax, domain, MX, disposable, role, SMTP, and catch-all signals without claiming that any verifier can guarantee delivery or inbox placement.

The site includes original email-verification and deliverability guides, About, Contact, Privacy, and Terms pages. Google AdSense and Google Analytics remain disabled until valid production identifiers are configured.

## Architecture

- **Vercel / Next.js:** public website, content pages, local CSV parsing, deduplication, filtering, and export.
- **Render / FastAPI:** batch verification and optional CSV upload/deletion endpoints.
- **Backblaze B2:** private, encrypted, short-retention CSV objects. The bucket and object names must never contain email addresses, contact names, or other personal data.
- **Firebase / Firestore:** server-only upload metadata plus contact-form messages. CSV rows and original CSV filenames are never written to Firestore.

The original CSV is uploaded only when the user selects the optional storage checkbox. B2 and Firebase credentials remain on Render and are never exposed to the frontend. If the Firestore record cannot be created, the API rolls back the B2 upload.

## Local development

Copy `.env.example` to `.env.local`, then run the Vercel-compatible frontend:

```powershell
npm install
npm run dev:vercel
```

Run the API in a second terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

The existing `npm run dev` and `npm run build` commands retain compatibility with the Sites-hosted version. Vercel uses `npm run build:vercel` from `vercel.json`.

## Backblaze B2

Create a **private** bucket with default SSE-B2 encryption and a bucket-scoped application key. Configure these secrets on Render:

- `B2_ENDPOINT`
- `B2_REGION`
- `B2_BUCKET`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `UPLOAD_TOKEN_SECRET`

Set a bucket lifecycle rule for the `uploads/` prefix so files are hidden after one day and permanently deleted after the shortest acceptable hidden-file period. The API returns a deletion token so a user can remove an object immediately without an account. Do not expose list or download permissions to the browser.

## Firebase / Firestore

Create a Firebase project and a Firestore Standard database in Native mode. The checked-in `firestore.rules` deny every direct browser read and write because only the Render backend uses the Admin SDK.

Create a dedicated Firebase service account with the minimum Firestore access needed by the API, then configure these values on Render:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_ID=(default)`

Never add the service-account JSON or private key to Git. The API writes optional-upload metadata to `csv_uploads/{uploadId}` and contact form submissions to `contact_messages/{messageId}`. Contact messages include only the submitted name, reply email, topic, message, status, and timestamps. Browser access remains blocked by Firestore rules; the Render backend uses the Admin SDK.

## Render

`render.yaml` defines the FastAPI service. Set `CORS_ORIGINS` to the final Vercel production origin and any approved preview origins. The start command binds Uvicorn to Render's `$PORT` on `0.0.0.0` and `/health` is the health check.

Render free web services block outbound SMTP ports. Leave `SMTP_ENABLED=false` on the free tier; mailbox results will remain `unknown` when DNS and MX pass. A paid service that permits responsible outbound SMTP is required before enabling `SMTP_ENABLED=true`. Enable `CATCH_ALL_ENABLED=true` only after SMTP probing is working.

## Vercel

Configure these project variables for Production and Preview as appropriate:

- `NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`
- `NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN.example`
- `NEXT_PUBLIC_CONTACT_EMAIL=YOUR-PUBLIC-SUPPORT-ADDRESS`
- `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-YOUR-PUBLISHER-ID` (only after the publisher ID is available)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-YOUR-MEASUREMENT-ID` (only after the GA4 web stream exists)

Both Google integrations are configuration-driven. Blank or invalid identifiers produce no Google script tags. The AdSense publisher ID also generates the root `ads.txt` response dynamically.

Deploy with the Vercel dashboard or `vercel --prod`. Next.js is selected explicitly in `vercel.json`.

## AdSense launch checklist

Before requesting review:

1. Use a stable custom domain with HTTPS and no login wall.
2. Publish a real public support email on the Contact page.
3. Review every guide and legal page for accuracy and ownership.
4. Configure the Google-certified CMP / Privacy & messaging flow for the EEA, UK, and Switzerland.
5. Add the exact AdSense publisher ID and the correct `ads.txt` entry supplied by Google. Do not publish a placeholder publisher ID.
6. Keep ads off the CSV workspace and other low-content or behavioral screens. Add conservative placements to substantial guide pages only after approval.
7. Confirm `robots.txt` and `sitemap.xml` use the final `NEXT_PUBLIC_SITE_URL`.
8. Verify navigation, mobile layout, API health, CSV deletion, retention, and all public pages.

AdSense approval is decided by Google and cannot be guaranteed by code or layout changes.

## Verification limitations

A `valid` result means the receiving server accepted the verification request at that moment. It does not guarantee delivery, inbox placement, identity, permission, or future availability. `unknown` means the provider blocked the check, timed out, or SMTP was unavailable; it is not automatically valid.
