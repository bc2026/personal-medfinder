# Personal Medfinder

A self-hosted workflow tool to find nearby pharmacies, log outreach calls, and track medication stock notes — **not** a real-time inventory service.

## What it does

- Create medication search sessions (name, strength, quantity, ZIP, radius)
- Find nearby pharmacies via OpenStreetMap (Nominatim + Overpass), with mock fallback
- Log contact status, notes, price quotes, insurance, and next steps per pharmacy
- **Stock map** on each session — color-coded pins for in stock, partial, out, etc.
- Optional **AI voice agent** (Vapi) to call pharmacies and auto-log stock results
- Dashboard with aggregate stats and search history
- Export one session as JSON or all sessions as CSV

## Honest limits

Pharmacy inventory is **not** publicly available in most cases. This app helps you **organize outreach** and record what pharmacies tell you by phone. It does not guarantee in-stock availability.

## Stack

| Layer    | Tech                                      |
| -------- | ----------------------------------------- |
| Frontend | Vite, React, TypeScript, Tailwind CSS v4  |
| Backend  | Node.js, Express, Prisma, SQLite, Zod     |
| Search   | OpenStreetMap (default) or Google Places  |

## Quick start

```bash
# From project root
npm install
cp backend/.env.example backend/.env
npm run setup    # installs deps, creates DB, seeds demo data
npm run dev      # API :3001 + web :5173
```

Open **http://localhost:5173**. Docker (`npm run docker:up`) uses the same ports, env file, and database file.

### Manual start

```bash
# Terminal 1 — API
cd backend
npm install
npm run setup
npm run dev

# Terminal 2 — Web
cd frontend
npm install
npm run dev
```

## Project structure

```
medzzz/
├── backend/
│   ├── prisma/schema.prisma   # SearchSession, Pharmacy, PharmacyContactLog
│   ├── prisma/seed.ts         # Demo Lisinopril session
│   └── src/
│       ├── index.ts
│       ├── routes/sessions.ts
│       └── services/pharmacySearch.ts
├── frontend/
│   └── src/
│       ├── pages/             # Dashboard, NewSearch, SessionDetail
│       └── components/
└── README.md
```

## API routes

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Health check |
| GET | `/api/sessions/dashboard` | Aggregate stats |
| GET | `/api/sessions` | List sessions |
| GET | `/api/sessions/:id` | Session with pharmacies |
| POST | `/api/sessions` | New search + pharmacy lookup |
| POST | `/api/sessions/:sid/pharmacies/:pid/contact` | Add contact log |
| GET | `/api/sessions/:id/export` | JSON export |
| GET | `/api/sessions/export/all.csv` | CSV export |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/voice/config` | Whether voice agent is configured |
| POST | `/api/voice/sessions/:sid/pharmacies/:pid/call` | Start outbound stock-check call |
| POST | `/api/webhooks/vapi` | Vapi end-of-call webhook (for Vapi only) |

## Configuration

Copy `backend/.env.example` to `backend/.env`:

```env
DATABASE_URL="file:./dev.db"
PORT=3001
PHARMACY_SEARCH_PROVIDER=nominatim   # nominatim | google | mock
GOOGLE_PLACES_API_KEY=               # required when provider=google
```

### Google Places

1. Enable **Places API (New)** and **Geocoding API** in [Google Cloud Console](https://console.cloud.google.com/).
2. Create an API key and restrict it to those APIs.
3. Set `PHARMACY_SEARCH_PROVIDER=google` and `GOOGLE_PLACES_API_KEY` in `backend/.env`.

### Voice agent (Vapi)

Medfinder can place **outbound phone calls** with a voice AI that asks pharmacies about stock and writes results into your contact log.

1. Create a [Vapi](https://vapi.ai) account.
2. Import or buy a **phone number** in Vapi (used as caller ID).
3. Add to `backend/.env`:
   - `VAPI_API_KEY` — from the Vapi dashboard
   - `VAPI_PHONE_NUMBER_ID` — ID of your outbound number
   - `PUBLIC_API_URL` — URL Vapi can reach for webhooks (see below)
   - Optional: `VAPI_ASSISTANT_ID` if you prefer a dashboard-tuned assistant; otherwise a built-in prompt is used
   - Optional: `VAPI_WEBHOOK_SECRET` — shared secret for webhook verification
4. **Webhooks in dev:** Vapi must POST to your API. Run [ngrok](https://ngrok.com) (or similar) and set `PUBLIC_API_URL=https://your-tunnel.ngrok.io` (no trailing path).
5. In the app, open a session and click **AI call to check stock** on a pharmacy card.

The agent identifies itself as automated, avoids sharing patient PHI, and extracts structured status (`in_stock`, `out_of_stock`, etc.) after each call.

**Caveats:** Real pharmacies may refuse automated calls, put you on hold, or require HIPAA-compliant handling for patient-specific questions. Use for personal workflow only; review Vapi pricing and local robocall rules.

## Docker

Docker uses the **same** setup as local dev: `backend/.env`, `backend/dev.db`, ports **5173** (web) and **3001** (API).

```bash
cp backend/.env.example backend/.env
npm run docker:setup   # once: DB + demo seed (same as npm run setup)
npm run docker:up      # Vite + tsx watch with hot reload
```

Open **http://localhost:5173** — same URL as `npm run dev`.

| Item | Notes |
| ---- | ----- |
| UI | `http://localhost:5173` |
| API | `http://localhost:3001` |
| Config | `backend/.env` |
| Database | `backend/dev.db` (shared with local dev) |

### Production-style Docker (optional)

Built static frontend + nginx, API on internal network only:

```bash
npm run docker:prod    # web on http://localhost:8080 (WEB_PORT)
```

For Vapi webhooks with `docker:prod`, tunnel to port **8080** and set `PUBLIC_API_URL` to the tunnel origin. With `docker:up` / `npm run dev`, tunnel to **3001** instead (see Voice agent above).

## Deploy later

- Move SQLite → Postgres by changing `provider` in `schema.prisma` and `DATABASE_URL`
- Build frontend: `cd frontend && npm run build` → serve `dist/` behind nginx or deploy API + static separately
- Restrict Google API key by HTTP referrer or IP in production

## License

MIT — personal use.
