# n8n Pipelines for Flood Guard AI

This folder contains production-style n8n workflows for advanced real-time flood automation.

## Start n8n

```bash
cd n8n
docker compose up -d
```

Open:

```text
http://localhost:5678
```

## Configure backend webhook secret

In `backend/.env`:

```env
N8N_WEBHOOK_SECRET=replace_with_strong_secret
```

In n8n HTTP Request nodes, set header:

```text
X-N8N-Signature: <hex hmac sha256 of raw body using N8N_WEBHOOK_SECRET>
```

If you want quick local testing first, leave `N8N_WEBHOOK_SECRET` empty.

## Import workflows

Import JSON files from `n8n/workflows/`:

1. `weather_to_alert_escalation.json`
2. `river_threshold_escalation.json`
3. `geo_targeted_user_alerts.json`

## Backend endpoints used

- `POST /api/n8n/ingest/event`
- `POST /api/n8n/ingest/alert`
- `GET /api/n8n/events`
- `GET /api/n8n/alerts`
- Existing combined feed: `GET /api/alerts` (now includes n8n alerts)

