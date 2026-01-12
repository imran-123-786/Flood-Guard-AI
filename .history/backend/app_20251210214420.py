# ============================================================
# 🌊 Flood Guard Backend (Final Stable Version)
# Includes:
# - Real Weather API support
# - Free Rule-based Flood Prediction
# - Secure News Proxy
# - Shelter Finder
# ============================================================

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load .env keys
load_dotenv()

app = Flask(__name__)
CORS(app)

# Keys
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")


# ---------------- ROOT ----------------
@app.route("/")
def home():
    return jsonify({
        "message": "Flood Guard Backend Running 🚀",
        "weather_api": bool(OPENWEATHER_API_KEY),
        "news_api": bool(NEWSDATA_API_KEY),
        "timestamp": datetime.now().isoformat()
    })


# ---------------- HEALTH CHECK ----------------
@app.route("/api/health")
def health():
    return jsonify({"status": "online", "time": datetime.now().isoformat()})


#  WEATHER 
@app.route("/api/weather", methods=["GET"])
def get_weather():
    try:
        lat = request.args.get("lat", "20.5937")
        lon = request.args.get("lon", "78.9629")

        # If no key — provide simulated demo data
        if not OPENWEATHER_API_KEY:
            return jsonify({
                "temperature": 29.4,
                "humidity": 76,
                "pressure": 1009,
                "rainfall": 12.1,
                "wind_speed": 3.4,
                "description": "simulated rain",
                "location": "Simulated India",
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



# ---------------- FLOOD RISK PREDICTION ----------------
@app.route("/api/predict-risk", methods=["POST"])
def predict_risk():
    data = request.get_json() or {}

    rainfall = float(data.get("rainfall_mm_24h", 0))
    humidity = float(data.get("humidity", 0))
    temp = float(data.get("temperature_c", 25))

    score = 0.0

    # Contribution logic
    if rainfall > 100: score += 0.7
    elif rainfall > 60: score += 0.5
    elif rainfall > 30: score += 0.3
    elif rainfall > 10: score += 0.1

    if humidity > 90: score += 0.3
    elif humidity > 80: score += 0.2
    elif humidity > 70: score += 0.1

    if temp < 20: score += 0.05

    if score >= 0.8:
        risk = "High Risk"
        level = 3
    elif score >= 0.5:
        risk = "Moderate Risk"
        level = 2
    elif score >= 0.25:
        risk = "Low Risk"
        level = 1
    else:
        risk = "No Significant Flood Risk"
        level = 0

    return jsonify({
        "predicted_risk_level": level,
        "risk_label": risk,
        "confidence": round(min(score + 0.2, 1.0) * 100, 2),
        "score": score
    })


# ---------------- SHELTERS ----------------
@app.route("/api/shelters", methods=["GET"])
def shelters():
    return jsonify({
        "shelters": [
            {"name": "Government School Shelter", "distance": "1.2 km"},
            {"name": "Municipal Relief Center", "distance": "2.4 km"},
            {"name": "Community Hall Safe Zone", "distance": "3.0 km"}
        ]
    })


# ---------------- LIVE NEWS ----------------
@app.route("/api/news", methods=["GET"])
def get_news():
    lang = request.args.get("lang", "en")

    # Use valid categories + flood keyword filter
    url = (
        f"https://newsdata.io/api/1/news?"
        f"apikey={NEWSDATA_API_KEY}&country=in&language={lang}"
        f"&category=environment,domestic,world"
        f"&q=flood OR rainfall OR rescue OR disaster"
    )

    try:
        response = requests.get(url, timeout=10)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ---------------- RUN APP ----------------
if __name__ == "__main__":
    print("🚀 Flood Guard Backend Running at: http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
