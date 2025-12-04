# ============================================================
# 🌊 Flood Guard Backend (Final Combined Version)
# Includes:
# - Real Weather API support
# - Shelter Finder
# - AI Flood ML Model Prediction
# - Battery + Health endpoints
# - CORS Enabled
# ============================================================

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from datetime import datetime
from dotenv import load_dotenv
import joblib
import numpy as np
import pandas as pd

# ----------------------------
# Load environment variables
# ----------------------------
load_dotenv()

app = Flask(__name__)
CORS(app)

# ----------------------------
# API Keys
# ----------------------------
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# ----------------------------
# Load ML Model
# ----------------------------
MODEL_PATH = "models/flood_ml_model.pkl"
FEATURES_PATH = "models/flood_model_features.pkl"

flood_model = None
feature_list = None

if os.path.exists(MODEL_PATH):
    flood_model = joblib.load(MODEL_PATH)
    if os.path.exists(FEATURES_PATH):
        feature_list = joblib.load(FEATURES_PATH)
    print("🔥 AI Flood Model Loaded Successfully")
else:
    print("⚠ ML Model NOT FOUND. ML endpoint disabled.")


# ============================================================
# ✔ BASIC ENDPOINTS
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "message": "Flood Guard Backend Running",
        "weather_api": bool(OPENWEATHER_API_KEY),
        "google_maps_api": bool(GOOGLE_MAPS_API_KEY),
        "ml_model_loaded": bool(flood_model),
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "online", "time": datetime.now().isoformat()})


@app.route("/api/maps-key")
def maps_key():
    return jsonify({"maps_key": GOOGLE_MAPS_API_KEY})


# ============================================================
# 🌦 WEATHER API ENDPOINT
# ============================================================

@app.route("/api/weather", methods=["GET"])
def get_weather():
    try:
        lat = request.args.get("lat", "12.9716")
        lon = request.args.get("lon", "77.5946")

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
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# 🧠 AI MODEL PREDICTION ENDPOINT
# ============================================================

@app.route("/api/predict-risk", methods=["POST"])
def predict_risk():
    if flood_model is None or feature_list is None:
        return jsonify({"error": "ML model not loaded"}), 500

    data = request.get_json()
    row = []

    # Ensure input matches feature order
    for feature in feature_list:
        row.append(data.get(feature, 0))

    input_data = np.array(row).reshape(1, -1)

    prediction = int(flood_model.predict(input_data)[0])
    probabilities = flood_model.predict_proba(input_data)[0]

    response = {
        "predicted_risk_level": prediction,
        "confidence": round(max(probabilities) * 100, 2),
        "risk_label": {
            0: "No Flood",
            1: "Low Risk",
            2: "Moderate Risk",
            3: "High Risk"
        }[prediction]
    }

    return jsonify(response)


# ============================================================
# 🏥 SHELTER FINDER (Static fallback)
# ============================================================

@app.route("/api/shelters", methods=["GET"])
def shelters():
    return jsonify({
        "shelters": [
            {"name": "Government School Shelter", "distance": "1.2 km"},
            {"name": "Municipal Building Relief Center", "distance": "2.5 km"},
            {"name": "Community Hall Safe Zone", "distance": "3.1 km"}
        ]
    })


# ============================================================
# 🚀 RUN THE SERVER
# ============================================================

if __name__ == "__main__":
    print("🚀 Flood Guard Server Running at: http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
