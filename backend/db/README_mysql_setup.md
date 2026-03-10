# MySQL Setup (Flood Guard Backend)

## 1) Install dependency

```bash
pip install -r backend/requirements.txt
```

## 2) Create MySQL database

```sql
CREATE DATABASE flood_guard_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3) Add env vars in `backend/.env`

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=flood_guard_ai
```

Optional existing keys:

```env
OPENWEATHER_API_KEY=...
NEWSDATA_API_KEY=...
```

## 4) Run backend

```bash
cd backend
python app.py
```

Backend auto-initializes schema from:

```text
backend/db/schema.sql
```

## 5) Check DB status API

```text
GET /api/db/status
```

Expected when ready:

```json
{
  "enabled": true,
  "schema_ready": true,
  "connected": true
}
```

