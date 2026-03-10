# Flood Guard AI

Real-Time Urban Flood Monitoring and Decision Support Platform.

Flood Guard AI is a GIS-integrated flood intelligence system built for urban flood preparedness and response.  
It combines weather APIs, geospatial modeling, micro-hotspot generation, ward-level readiness scoring, and action planning into a single operational dashboard.

---

## Problem Statement Alignment

This project is designed to address:

> "Develop a GIS-integrated predictive system to identify 2,500+ urban flood micro-hotspots using historical rainfall data, terrain elevation, and drainage capacity.  
> Generate a ward-level Pre-Monsoon Readiness Score to enable proactive resource deployment before heavy rainfall events."

### Current status

- GIS-integrated map + area-aware analytics: `Implemented`
- 2,500+ micro-hotspots: `Implemented` (current engine generates ~2504)
- Hydrology factors used:
  - historical rainfall
  - terrain elevation
  - drainage capacity
- Ward-level readiness: `Implemented`
- Proactive deployment recommendations: `Implemented`
- Decision support workflow (citizen + authority actions): `Implemented`

---

## Core Capabilities

- Live weather intelligence (temperature, rainfall, humidity, wind)
- Click-anywhere map intelligence (state/city/village/district + weather)
- AI flood risk prediction with ward/district drivers
- 48-hour flood forecast
- Live flood alerts with severity
- 2500+ micro-hotspot generation and map visualization
- Ward-level pre-monsoon readiness and deployment plan
- Safe route planning to nearest safe places
- Radar tab (storm layers + nowcast insights)
- Multilingual disaster news (`en`, `hi`, `ta`, `kn`, `te`, `mr`, `bn`)
- Satellite hotspot snapshots
- Community board (volunteers + help requests + matching)
- History timeline (filter, export, clear)
- Account register/login/logout (local file-backed)
- Branded favicon + web app metadata

---

## Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Leaflet (map)
- Leaflet Heat Layer

### Backend
- Python 3
- Flask
- Flask-CORS
- Pandas
- Requests
- python-dotenv

### External Services
- OpenWeather (weather + forecast + reverse support)
- Nominatim / maps.co reverse geocoding
- Overpass (safe places / amenities)
- OSRM (routing)
- Windy embeds (radar layers)
- ArcGIS World Imagery (satellite snapshots)
- NewsData API (optional live news)

---

## Repository Structure

```text
flood-guard-app/
  backend/
    app.py
    requirements.txt
    data/
      flood_zone_summary.csv
      india_flood_micro_hotspots.csv
      ...
    utils/
      generate_hotspots.py
      generate_micro_hotspots.py
      generate_readiness_scores.py
  frontend/
    index.html
    css/style.css
    js/app.js
    js/translations.json
    assets/
      floodguard-favicon.svg
      site.webmanifest
    video/
      rain_background.mp4
  README.md
```

---

## Setup and Run

## 1) Clone

```bash
git clone https://github.com/imran-123-786/Flood-Guard-AI.git
cd flood-guard-app
```

## 2) Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
OPENWEATHER_API_KEY=your_openweather_key
NEWSDATA_API_KEY=your_newsdata_key
```

Run backend:

```bash
python app.py
```

Backend default URL:

```text
http://127.0.0.1:5000
```

## 3) Frontend Setup

From project root, open:

```text
frontend/index.html
```

Recommended: use VS Code Live Server or any local static server.  
Then hard refresh (`Ctrl+F5`) after updates.

---

## Backend API Reference

### Health and Core
- `GET /` - backend info
- `GET /api/health` - health check

### Location and Weather
- `GET /api/weather?lat=&lon=`
- `GET /api/location-intel?lat=&lon=`

### Modeling and Risk
- `POST /api/predict-risk`
- `GET /api/flood-forecast?lat=&lon=`
- `GET /api/alerts?lat=&lon=`
- `GET /api/action-plan?lat=&lon=`

### Hotspots and Readiness
- `GET /api/flood-hotspots`
- `GET /api/hotspots` (alias)
- `GET /api/hotspot-analysis`
- `GET /api/hydrology-engine-summary`
- `GET /api/readiness-score`
- `GET /api/hotspot-satellite?limit=`

### Mobility and Safety
- `GET /api/shelters?lat=&lon=&radius_km=`
- `GET /api/safe-route?lat=&lon=&target_lat=&target_lon=&target_name=`

### News and Account
- `GET /api/news?lang=en|hi|ta|kn|te|mr|bn`
- `POST /api/account/register`
- `POST /api/account/login`
- `GET /api/account/profile?token=...`
- `POST /api/account/logout`

---

## Hydrology Engine Method

The current engine constructs ward-like micro-zones around district centroids and computes flood risk using:

- historical rainfall signal
- terrain/elevation vulnerability
- derived drainage capacity
- readiness weakness

### Output artifacts

- `risk_score` per micro-hotspot/ward
- `drainage_capacity` per ward
- `readiness_score` per ward
- risk class distribution
- deployment recommendations (pumps, boats, teams)

### Typical risk bands

- `High` (upper band, requires immediate prep)
- `Moderate` (monitor and pre-position)
- `Low` (routine monitoring)

---

## Frontend User Flows

### Dashboard
- Shows selected-area weather and risk cards.
- Click on map to set active area.
- All tabs refresh to selected area context.

### Action Plan
- Generates actionable guidance for:
  - citizens
  - authorities
- Includes nearest safe places and severity.

### Route
- Displays safe places list.
- Allows user to choose destination and generate route.

### Community
- Register volunteers.
- Create help requests.
- Match volunteers to requests by area.

### History
- Unified event timeline.
- Filter by event type.
- Export JSON.
- Clear history.

---

## Hackathon Demo Script (Suggested)

1. Open Dashboard and click a vulnerable location.
2. Show map popup with local weather + admin details.
3. Open Hotspots:
   - total micro-hotspots
   - high/moderate/low counts
   - satellite snapshots
4. Open Readiness:
   - ward-level metrics
   - deployment plan
5. Open Action Plan:
   - clear "what to do now" for citizens and authorities.
6. Open Route:
   - choose safe destination and generate route.
7. Open Community + History:
   - register volunteer, post request, show timeline logs.

---

## Known Notes

- News and some geospatial providers can rate-limit or fail; fallback responses are implemented.
- Routing may use fallback path when external routing service is unavailable.
- Search engine favicon visibility requires deployed public domain and indexing.

---

## Security and Data

- Account system currently stores users in local JSON (`backend/data/users.json`).
- Session tokens are in-memory for current runtime.
- For production, migrate to secure DB + JWT/redis/session store.

---

## Future Enhancements

- Real gauge/river-level ingestion
- IoT drain/pump telemetry
- Official alert integration (CAP)
- Uncertainty bands for forecast
- Damage and recovery tracking
- GeoJSON/CSV export endpoints for authority integration

---

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Open pull request

---

## License

See [`LICENSE`](LICENSE).

---

## Acknowledgements

- OpenStreetMap ecosystem (Nominatim, Overpass)
- OpenWeather APIs
- Windy embeds
- ArcGIS World Imagery
- NewsData API

