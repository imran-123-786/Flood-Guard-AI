# API Documentation

## Base URL
http://localhost:5000

---

### GET /api/weather
Fetch real-time weather.

Response:

{
  "temperature": 29.4,
  "humidity": 82,
  "rainfall": 12
}

---

### POST /api/predict-risk

Body:

{
  "rainfall": 20,
  "humidity": 85,
  "temperature": 27
}

Response:

{
  "risk_level": "Medium",
  "confidence": "78%"
}

---

### GET /api/shelters
Returns nearby shelters.
