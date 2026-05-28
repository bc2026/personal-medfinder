# Personal Medfinder

A self-hosted workflow tool to find nearby pharmacies, log outreach calls, and track medication stock notes — **not** a real-time inventory service.

## What it does

- Create medication search sessions (name, strength, quantity, ZIP, radius)
- Find nearby pharmacies via OpenStreetMap (Nominatim + Overpass), with mock fallback
- Log contact status, notes, price quotes, insurance, and next steps per pharmacy
- Dashboard with aggregate stats and search history
- Export one session as JSON or all sessions as CSV

## Honest limits

Pharmacy inventory is **not** publicly available in most cases. This app helps you **organize outreach** and record what pharmacies tell you by phone. It does not guarantee in-stock availability.

## Stack

| Layer    | Tech                                      |
| -------- | ----------------------------------------- |
| Frontend | Vite, React, TypeScript, Tailwind CSS v4  |
| Backend  | Node.js, Express, Prisma, SQLite, Zod     |
| Search   | OpenStreetMap Nominatim + Overpass API    |

## Quick start

```bash
# From project root
npm install
npm run setup    # installs deps, creates DB, seeds demo data
npm run dev      # API :3001 + web :5173
```

Open **http://localhost:5173**

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

## Configuration

Copy `backend/.env.example` to `backend/.env`:

```env
DATABASE_URL="file:./dev.db"
PORT=3001
PHARMACY_SEARCH_PROVIDER=nominatim   # or "mock" for offline demo only
```

## Deploy later

- Move SQLite → Postgres by changing `provider` in `schema.prisma` and `DATABASE_URL`
- Build frontend: `cd frontend && npm run build` → serve `dist/` behind nginx or deploy API + static separately
- Add `GOOGLE_PLACES_API_KEY` and extend `pharmacySearch.ts` for Google Places

## License

MIT — personal use.
