# backend/app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from datetime import datetime
from dotenv import load_dotenv
import joblib
import numpy as np

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")


# ================== ML MODEL LOADING ==================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "flood_ml_model.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "models", "flood_model_features.pkl")

flood_model = None
feature_list = None

print("📁 Checking model files...")

if os.path.exists(MODEL_PATH) and os.path.exists(FEATURES_PATH):
    try:
        flood_model = joblib.load(MODEL_PATH)
        feature_list = joblib.load(FEATURES_PATH)
        print("🔥 AI Flood Model Loaded Successfully")
    except Exception as e:
        print("⚠ Error loading ML model:", e)
        flood_model = None
else:
    print("⚠ ML Model Not Found — Using Rule-Based Prediction")


# ================= BASIC =================

@app.route("/")
def home():
    return jsonify({
        "message": "Flood Guard Backend Running",
        "weather_api": bool(OPENWEATHER_API_KEY),
        "ml_model_loaded": bool(flood_model),
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "online", "time": datetime.now().isoformat()})


# ================= WEATHER =================

@app.route("/api/weather", methods=["GET"])
def get_weather():
    try:
        lat = request.args.get("lat", "12.9716")
        lon = request.args.get("lon", "77.5946")

        if not OPENWEATHER_API_KEY:
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

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        response = requests.get(url)
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


# ================= AI PREDICTION =================

@app.route("/api/predict-risk", methods=["POST"])
def predict_risk():
    data = request.get_json() or {}

    # ---- If ML model is loaded, use it ----
    if flood_model and feature_list:
        print("🤖 Using ML Model...")

        try:
            input_row = []
            for feature in feature_list:
                input_row.append(float(data.get(feature, 0)))

            input_array = np.array(input_row).reshape(1, -1)
            prediction = int(flood_model.predict(input_array)[0])
            prob = max(flood_model.predict_proba(input_array)[0])

            label = ["No Risk", "Low Risk", "Moderate Risk", "High Risk"][prediction]

            return jsonify({
                "mode": "ml_model",
                "predicted_risk_level": prediction,
                "risk_label": label,
                "confidence": round(prob * 100, 2)
            })
        except Exception as e:
            print("⚠ ML error, fallback:", e)

    # ---- FALLBACK RULE SYSTEM ----
    print("🟡 Using Rule-Based Prediction")

    rainfall = float(data.get("rainfall_mm_24h", 0))
    humidity = float(data.get("humidity", 0))
    temp = float(data.get("temperature_c", 25))

    score = 0.0

    if rainfall > 100: score += 0.7
    elif rainfall > 60: score += 0.5
    elif rainfall > 30: score += 0.3
    elif rainfall > 10: score += 0.1

    if humidity > 90: score += 0.3
    elif humidity > 80: score += 0.2
    elif humidity > 70: score += 0.1

    if temp < 20: score += 0.05

    if score >= 0.8:
        level, label = 3, "High Risk"
    elif score >= 0.5:
        level, label = 2, "Moderate Risk"
    elif score >= 0.25:
        level, label = 1, "Low Risk"
    else:
        level, label = 0, "No Flood Risk"

    return jsonify({
        "mode": "rule_based",
        "predicted_risk_level": level,
        "risk_label": label,
        "score": round(score, 2),
        "confidence": round(min(score + 0.2, 1.0) * 100, 2)
    })


# ================= SHELTERS =================

@app.route("/api/shelters", methods=["GET"])
def shelters():
    return jsonify({
        "shelters": [
            {"name": "Government School Shelter", "distance": "1.2 km"},
            {"name": "Municipal Relief Center", "distance": "2.5 km"},
            {"name": "Community Hall Safe Zone", "distance": "3.1 km"},
        ]
    })


if __name__ == "__main__":
    print("🚀 Flood Guard Server Running at http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
