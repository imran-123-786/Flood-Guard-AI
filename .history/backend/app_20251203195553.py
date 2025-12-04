# backend/app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# ---------------- BASIC ----------------

@app.route("/")
def home():
    return jsonify({
        "message": "Flood Guard Backend Running",
        "weather_api": bool(OPENWEATHER_API_KEY),
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "online", "time": datetime.now().isoformat()})


# ---------------- WEATHER ----------------

@app.route("/api/weather", methods=["GET"])
def get_weather():
    try:
        lat = request.args.get("lat", "12.9716")
        lon = request.args.get("lon", "77.5946")

        if not OPENWEATHER_API_KEY:
            # Fallback simulated data if no API key
            return jsonify({
                "temperature": 28.5,
                "humidity": 78,
                "pressure": 1008,
                "rainfall": 15.3,
                "wind_speed": 4.2,
                "description": "simulated cloudy",
                "location": "Simulated City",
                "timestamp": datetime.now().isoformat(),
                "source": "simulated"
            })

        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        return jsonify({
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "pressure": data["main"]["pressure"],
            "rainfall": data.get("rain", {}).get("1h", 0),
            "wind_speed": data["wind"]["speed"],
            "description": data["weather"][0]["description"],
            "location": data.get("name", "Unknown"),
            "timestamp": datetime.now().isoformat(),
            "source": "openweather"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    


# ---------------- AI PREDICTION (RULE-BASED) ----------------

@app.route("/api/predict-risk", methods=["POST"])
def predict_risk():
    """
    Simple rule-based "AI" so it always works even without model file.
    Uses temperature, humidity, rainfall.
    """
    data = request.get_json() or {}
    rainfall = float(data.get("rainfall_mm_24h", 0))
    humidity = float(data.get("humidity", 0))
    temp = float(data.get("temperature_c", 25))

    score = 0.0

    # Rain contribution
    if rainfall > 100:
        score += 0.7
    elif rainfall > 60:
        score += 0.5
    elif rainfall > 30:
        score += 0.3
    elif rainfall > 10:
        score += 0.1

    # Humidity contribution
    if humidity > 90:
        score += 0.3
    elif humidity > 80:
        score += 0.2
    elif humidity > 70:
        score += 0.1

    # Temperature minor effect
    if temp < 20:
        score += 0.05

    if score >= 0.8:
        level = 3
        label = "High Risk"
    elif score >= 0.5:
        level = 2
        label = "Moderate Risk"
    elif score >= 0.25:
        level = 1
        label = "Low Risk"
    else:
        level = 0
        label = "No Significant Flood Risk"

    return jsonify({
        "predicted_risk_level": level,
        "risk_label": label,
        "score": round(score, 2),
        "confidence": round(min(score + 0.2, 1.0) * 100, 2)
    })


# ---------------- SHELTERS (STATIC) ----------------

@app.route("/api/shelters", methods=["GET"])
def shelters():
    return jsonify({
        "shelters": [
            {"name": "Government School Shelter", "distance": "1.2 km"},
            {"name": "Municipal Building Relief Center", "distance": "2.5 km"},
            {"name": "Community Hall Safe Zone", "distance": "3.1 km"},
        ]
    })


if __name__ == "__main__":
    print("🚀 Flood Guard Server Running at: http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
