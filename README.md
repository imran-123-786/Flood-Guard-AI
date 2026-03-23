# Flood Guard AI

**User-first flood intelligence platform for India**  
Live weather, flood forecasting, river monitoring, safer travel routing, alerts, and automation in one product.

![Platform](https://img.shields.io/badge/Platform-Web%20%2B%20Mobile%20PWA-0a66c2)
![Backend](https://img.shields.io/badge/Backend-Flask-111827)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-0ea5e9)
![Database](https://img.shields.io/badge/Database-PostgreSQL-2563eb)
![Automation](https://img.shields.io/badge/Automation-n8n-f97316)

## Why Flood Guard AI

Flood Guard AI is built for daily users who need clear flood-risk awareness, not technical dashboards.  
The platform focuses on fast decisions: where risk is, which river is rising, and which route is safer right now.

## Core Capabilities

- Live flood dashboard with location-aware intelligence
- India river monitoring with risk markers and detail cards
- Forecast + AI prediction with contextual risk summaries
- Safer route planning between origin and destination
- Radar tab with weather overlays and river movement support
- Alerts center with escalation-ready messaging
- Rescue and safety workflows
- Account/session support
- Multilingual UX (8+ language-ready architecture)
- Real-time feedback collection and owner response flow
- n8n webhook ingestion for advanced event pipelines
- Offline-friendly PWA shell (service worker + manifest)

## Product Architecture

```text
Frontend (HTML/CSS/JS + Leaflet + PWA)
           |
           v
Backend API (Flask + ML/risk logic)
           |
           +--> PostgreSQL (users, feedback, app data)
           |
           +--> External APIs (weather/news/geocoding)
           |
           +--> n8n ingestion hooks (automation pipelines)
```

## Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Leaflet map engine
- Service Worker (`frontend/sw.js`)

### Backend
- Python 3.11+
- Flask + Flask-CORS
- Pandas + NumPy + scikit-learn
- Requests + python-dotenv

### Database
- PostgreSQL (primary)
- File fallback only for selected local/dev flows

### Automation
- n8n workflows for weather, river, and geo-targeted alerts

## Repository Layout

```text
flood-guard-AI/
  backend/
    app.py
    wsgi.py
    requirements.txt
    .env.example
    db/
      postgres_client.py
      repositories.py
      schema_postgres.sql
      README_postgresql_setup.md
    tests/
  frontend/
    index.html
    sw.js
    css/style.css
    js/app.js
    js/feedback.js
    assets/
  n8n/
    docker-compose.yml
    workflows/
```

## Quick Start

### 1) Clone

```bash
git clone <your-repo-url>
cd flood-guard-AI
```

### 2) Backend

```bash
cd backend
python -m venv .venv
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env` from `.env.example` and set values:

```env
OPENWEATHER_API_KEY=
NEWSDATA_API_KEY=
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me
POSTGRES_DB=flood_guard_ai
POSTGRES_SSLMODE=prefer
N8N_WEBHOOK_SECRET=
FLASK_DEBUG=0
HOST=0.0.0.0
PORT=5000
```

Run backend:

```bash
python app.py
```

### 3) Frontend

Open `frontend/index.html` with Live Server or static hosting.

### 4) Optional n8n

```bash
cd n8n
docker compose up -d
```

Import JSON workflows from `n8n/workflows/`.

## Key API Areas

- Health: `GET /api/health`, `GET /api/db/status`
- Live weather/intel: `GET /api/weather`, `GET /api/location-intel`
- Forecast/prediction: `GET /api/flood-forecast`, `POST /api/predict-risk`
- Rivers: `GET /api/rivers`
- Routing: `GET /api/interstate-safe-routes`
- Shelters/rescue: `GET /api/shelters`
- Account: register/login/profile/logout endpoints
- Feedback: submit/list/respond endpoints
- n8n ingestion: event/alert endpoints

## Production Deployment (Free/Low-Cost Friendly)

1. PostgreSQL: Supabase or Neon
2. Backend: Render / Railway / Fly.io
3. Frontend: Vercel / Netlify / Cloudflare Pages
4. n8n: self-host Docker VM (optional now)

Deploy order:
1. Create PostgreSQL and run schema
2. Deploy backend with env vars
3. Validate `/api/health` and `/api/db/status`
4. Deploy frontend and point API base URL to backend
5. Configure CORS for frontend domain
6. Add n8n webhook secret and import workflows

## What Not To Push

- `.env` files
- virtual environments (`.venv/`, `venv/`)
- runtime user data logs/jsonl
- n8n runtime state directory
- cache/build artifacts

## Security Baseline

- Keep `FLASK_DEBUG=0` in production
- Use strong DB password and webhook secret
- Enforce HTTPS on frontend and backend
- Restrict CORS to your real frontend domain
- Add periodic DB backup

## CI and Test

- CI workflow: `.github/workflows/ci.yml`
- Local smoke test:

```bash
cd backend
pytest -q
```

## Troubleshooting

### PowerShell activation issue

```powershell
.\.venv\Scripts\Activate.ps1
```

### Missing `psycopg2`

```bash
pip install psycopg2-binary
```

### Slow pandas import / interrupted startup

```bash
pip install --force-reinstall numpy==1.26.4 pandas==2.2.2
```

---

Built to become a practical, scalable, user-trusted flood intelligence startup.
