from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import math
import os
from datetime import datetime
from uuid import uuid4

import pandas as pd
import requests
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash
from db.mysql_client import init_schema, mysql_enabled
from db import repositories as db_repo


load_dotenv()

app = Flask(__name__)
CORS(app)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")
DB_BOOTSTRAP = {"enabled": False, "schema_ready": False, "message": "MySQL not configured"}

if mysql_enabled():
    try:
        ok, msg = init_schema()
        DB_BOOTSTRAP = {"enabled": True, "schema_ready": bool(ok), "message": msg}
    except Exception as _e:
        DB_BOOTSTRAP = {"enabled": True, "schema_ready": False, "message": str(_e)}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, "data")
USERS_FILE = os.path.join(DATA_FOLDER, "users.json")

INDIA_BOUNDS = {
    "lat_min": 6.0,
    "lat_max": 38.5,
    "lon_min": 68.0,
    "lon_max": 97.5,
}

SESSIONS = {}
ZONE_DF = None
HOTSPOT_DF = None
WARD_DF = None


def inside_india(lat, lon):
    return (
        INDIA_BOUNDS["lat_min"] <= lat <= INDIA_BOUNDS["lat_max"]
        and INDIA_BOUNDS["lon_min"] <= lon <= INDIA_BOUNDS["lon_max"]
    )


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def fetch_shelters_data(lat, lon, radius_km=15):
    radius_m = int(radius_km * 1000)
    query = f"""
[out:json][timeout:20];
(
  node(around:{radius_m},{lat},{lon})[amenity=shelter];
  node(around:{radius_m},{lat},{lon})[amenity=hospital];
  node(around:{radius_m},{lat},{lon})[amenity=school];
  node(around:{radius_m},{lat},{lon})[amenity=community_centre];
);
out body;
"""
    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            headers={"User-Agent": "FloodGuard/1.0 (contact: floodguard@example.com)"},
            timeout=25,
        )
        items = []
        for element in resp.json().get("elements", []):
            e_lat = element.get("lat")
            e_lon = element.get("lon")
            if e_lat is None or e_lon is None:
                continue
            dist = haversine_km(lat, lon, e_lat, e_lon)
            tags = element.get("tags", {})
            items.append(
                {
                    "name": tags.get("name") or tags.get("amenity", "Shelter").title(),
                    "type": tags.get("amenity", "unknown"),
                    "distance_km": round(dist, 2),
                    "latitude": e_lat,
                    "longitude": e_lon,
                    "address": ", ".join(
                        [
                            v
                            for v in [
                                tags.get("addr:street"),
                                tags.get("addr:city"),
                                tags.get("addr:state"),
                            ]
                            if v
                        ]
                    ),
                    "source": "openstreetmap",
                }
            )
        return sorted(items, key=lambda x: x["distance_km"])[:20]
    except Exception:
        fallback = [
            {
                "name": "District Relief Shelter",
                "type": "shelter",
                "distance_km": round(haversine_km(lat, lon, lat + 0.03, lon + 0.03), 2),
                "latitude": lat + 0.03,
                "longitude": lon + 0.03,
                "source": "fallback",
            },
            {
                "name": "Government School Evacuation Point",
                "type": "school",
                "distance_km": round(haversine_km(lat, lon, lat + 0.05, lon - 0.02), 2),
                "latitude": lat + 0.05,
                "longitude": lon - 0.02,
                "source": "fallback",
            },
            {
                "name": "Civil Hospital Safe Wing",
                "type": "hospital",
                "distance_km": round(haversine_km(lat, lon, lat - 0.04, lon + 0.04), 2),
                "latitude": lat - 0.04,
                "longitude": lon + 0.04,
                "source": "fallback",
            },
        ]
        return fallback


def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    os.makedirs(DATA_FOLDER, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=True, indent=2)


def get_zone_df():
    global ZONE_DF
    if ZONE_DF is None:
        path = os.path.join(DATA_FOLDER, "flood_zone_summary.csv")
        df = pd.read_csv(path)
        df.columns = df.columns.str.lower()
        for col in ["latitude", "longitude", "readiness_score", "rainfall_mm", "elevation"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        ZONE_DF = df.dropna(subset=["latitude", "longitude"]).copy()
    return ZONE_DF


def get_hotspot_df():
    global HOTSPOT_DF
    if HOTSPOT_DF is None:
        zone = get_zone_df().copy()
        zone["rainfall_mm"] = zone["rainfall_mm"].fillna(0).clip(lower=0)
        zone["elevation"] = zone["elevation"].fillna(zone["elevation"].median())
        zone["readiness_score"] = zone["readiness_score"].fillna(zone["readiness_score"].median())

        max_rain = max(float(zone["rainfall_mm"].max()), 1.0)
        max_elev = max(float(zone["elevation"].max()), 1.0)

        ward_offsets = [
            (-0.025, -0.025, "NW"),
            (-0.025, 0.025, "NE"),
            (0.025, -0.025, "SW"),
            (0.025, 0.025, "SE"),
        ]
        records = []

        for _, row in zone.iterrows():
            base_lat = float(row["latitude"])
            base_lon = float(row["longitude"])
            district = str(row.get("district", "Unknown"))
            rainfall = float(row.get("rainfall_mm", 0))
            elevation = float(row.get("elevation", 100))
            readiness = float(row.get("readiness_score", 60))

            rain_component = min(max(rainfall / max_rain, 0), 1)
            low_elev_component = 1 - min(max(elevation / max_elev, 0), 1)
            low_readiness_component = 1 - min(max(readiness / 100.0, 0), 1)

            for idx, (dlat, dlon, sector) in enumerate(ward_offsets, start=1):
                lat = round(base_lat + dlat, 6)
                lon = round(base_lon + dlon, 6)
                if not inside_india(lat, lon):
                    continue

                drainage_capacity = round(
                    max(5, min(95, 92 - (rain_component * 42 + low_elev_component * 30 + low_readiness_component * 20))),
                    2,
                )
                low_drainage_component = 1 - min(max(drainage_capacity / 100.0, 0), 1)

                risk_base = (
                    0.40 * rain_component
                    + 0.25 * low_elev_component
                    + 0.20 * low_readiness_component
                    + 0.15 * low_drainage_component
                )
                risk_score = round(1 + min(max(risk_base, 0), 1) * 5, 2)
                ward_readiness = round(max(5, min(98, 100 - risk_base * 70)), 2)

                if elevation <= 50:
                    terrain_risk = "High"
                elif elevation <= 150:
                    terrain_risk = "Moderate"
                else:
                    terrain_risk = "Low"

                if rainfall >= 70:
                    rainfall_risk = "High"
                elif rainfall >= 30:
                    rainfall_risk = "Moderate"
                else:
                    rainfall_risk = "Low"

                records.append(
                    {
                        "district": district,
                        "ward_id": f"{district[:16].replace(' ', '_').upper()}_W{idx}_{sector}",
                        "latitude": lat,
                        "longitude": lon,
                        "elevation": round(elevation, 2),
                        "historical_rainfall_mm": round(rainfall, 2),
                        "terrain_risk": terrain_risk,
                        "rainfall_risk": rainfall_risk,
                        "drainage_capacity": drainage_capacity,
                        "readiness_score": ward_readiness,
                        "risk_score": risk_score,
                        "engine": "hydrology-ward-v1",
                    }
                )

        HOTSPOT_DF = pd.DataFrame.from_records(records)
    return HOTSPOT_DF


def get_ward_df():
    global WARD_DF
    if WARD_DF is None:
        WARD_DF = get_hotspot_df().copy()
    return WARD_DF


def nearest_zone_features(lat, lon):
    df = get_zone_df().copy()
    df["distance_km"] = df.apply(lambda r: haversine_km(lat, lon, float(r["latitude"]), float(r["longitude"])), axis=1)
    nearest = df.sort_values("distance_km").iloc[0]
    return {
        "district": nearest.get("district", "Unknown"),
        "distance_km": round(float(nearest.get("distance_km", 0)), 2),
        "readiness_score": float(nearest.get("readiness_score", 60)),
        "historical_rainfall_mm": float(nearest.get("rainfall_mm", 25)),
        "elevation": float(nearest.get("elevation", 100)),
    }


def nearest_ward_features(lat, lon):
    df = get_ward_df().copy()
    df["distance_km"] = df.apply(lambda r: haversine_km(lat, lon, float(r["latitude"]), float(r["longitude"])), axis=1)
    nearest = df.sort_values("distance_km").iloc[0]
    return {
        "ward_id": nearest.get("ward_id", "Unknown"),
        "district": nearest.get("district", "Unknown"),
        "distance_km": round(float(nearest.get("distance_km", 0)), 2),
        "readiness_score": float(nearest.get("readiness_score", 60)),
        "historical_rainfall_mm": float(nearest.get("historical_rainfall_mm", 25)),
        "elevation": float(nearest.get("elevation", 100)),
        "drainage_capacity": float(nearest.get("drainage_capacity", 60)),
        "ward_risk_score": float(nearest.get("risk_score", 3)),
    }


def hotspot_context(lat, lon):
    df = get_hotspot_df().copy()
    lat_delta = 1.2
    lon_delta = 1.2
    nearby = df[
        (df["latitude"] >= lat - lat_delta)
        & (df["latitude"] <= lat + lat_delta)
        & (df["longitude"] >= lon - lon_delta)
        & (df["longitude"] <= lon + lon_delta)
    ]
    if nearby.empty:
        return {"nearby_hotspots": 0, "avg_risk_score": 2.5}
    avg_risk = float(nearby["risk_score"].fillna(2.5).mean()) if "risk_score" in nearby.columns else 2.5
    return {"nearby_hotspots": int(len(nearby)), "avg_risk_score": round(avg_risk, 2)}


def compute_prediction(rainfall, humidity, temp, lat, lon, wind_speed=0):
    ward = nearest_ward_features(lat, lon)
    hotspot = hotspot_context(lat, lon)

    rainfall_component = min(max(rainfall / 120.0, 0), 1)
    humidity_component = min(max((humidity - 55) / 45.0, 0), 1)
    temp_component = min(max((28 - temp) / 20.0, 0), 1)
    wind_component = min(max(wind_speed / 18.0, 0), 1)

    historical_rain_component = min(max(ward["historical_rainfall_mm"] / 120.0, 0), 1)
    readiness_component = 1 - min(max(ward["readiness_score"] / 100.0, 0), 1)
    low_elevation_component = min(max((200 - ward["elevation"]) / 200.0, 0), 1)
    low_drainage_component = 1 - min(max(ward["drainage_capacity"] / 100.0, 0), 1)
    hotspot_component = min(max(hotspot["avg_risk_score"] / 6.0, 0), 1)

    score = (
        0.30 * rainfall_component
        + 0.14 * humidity_component
        + 0.04 * temp_component
        + 0.04 * wind_component
        + 0.16 * historical_rain_component
        + 0.14 * readiness_component
        + 0.06 * low_elevation_component
        + 0.07 * low_drainage_component
        + 0.06 * hotspot_component
    )
    score = round(min(max(score, 0), 1), 4)

    if score >= 0.72:
        risk = "High Risk"
        level = 3
    elif score >= 0.48:
        risk = "Moderate Risk"
        level = 2
    elif score >= 0.28:
        risk = "Low Risk"
        level = 1
    else:
        risk = "No Significant Flood Risk"
        level = 0

    return {
        "predicted_risk_level": level,
        "risk_label": risk,
        "confidence": round((0.62 + 0.34 * score) * 100, 2),
        "score": score,
        "drivers": {
            "rainfall_mm_24h": rainfall,
            "humidity": humidity,
            "temperature_c": temp,
            "wind_speed": wind_speed,
            "nearest_ward_id": ward["ward_id"],
            "nearest_district": ward["district"],
            "ward_distance_km": ward["distance_km"],
            "ward_readiness_score": ward["readiness_score"],
            "ward_historical_rainfall_mm": ward["historical_rainfall_mm"],
            "ward_elevation": ward["elevation"],
            "ward_drainage_capacity": ward["drainage_capacity"],
            "ward_risk_score": ward["ward_risk_score"],
            "nearby_hotspots": hotspot["nearby_hotspots"],
            "nearby_avg_hotspot_risk": hotspot["avg_risk_score"],
        },
    }


def reverse_geocode(lat, lon):
    def build_payload(address, display_name):
        state = address.get("state") or address.get("region") or address.get("state_district") or "Unknown"
        district = (
            address.get("state_district")
            or address.get("county")
            or address.get("city_district")
            or address.get("city")
            or "Unknown"
        )
        city = (
            address.get("city")
            or address.get("town")
            or address.get("municipality")
            or address.get("suburb")
            or address.get("county")
            or "Unknown"
        )
        village = (
            address.get("village")
            or address.get("hamlet")
            or address.get("neighbourhood")
            or address.get("quarter")
            or address.get("suburb")
            or "Unknown"
        )
        country = address.get("country", "Unknown")

        if city == "Unknown" and display_name != "Unknown":
            parts = [p.strip() for p in display_name.split(",")]
            if parts:
                city = parts[0]
        if village == "Unknown" and display_name != "Unknown":
            parts = [p.strip() for p in display_name.split(",")]
            if len(parts) > 1:
                village = parts[1]

        return {
            "state": state,
            "district": district,
            "city": city,
            "village": village,
            "country": country,
            "display_name": display_name,
        }

    def mostly_unknown(payload):
        unknown_fields = sum(
            1
            for k in ["state", "district", "city", "village", "country"]
            if payload.get(k, "Unknown") == "Unknown"
        )
        return unknown_fields >= 4

    fallback = {
        "state": "Unknown",
        "district": "Unknown",
        "city": "Unknown",
        "village": "Unknown",
        "country": "Unknown",
        "display_name": "Unknown",
    }

    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "jsonv2",
                "addressdetails": 1,
                "zoom": 18,
            },
            headers={"User-Agent": "FloodGuard/1.0 (contact: floodguard@example.com)"},
            timeout=10,
        )
        data = r.json()
        primary = build_payload(data.get("address", {}), data.get("display_name", "Unknown"))
    except Exception:
        primary = fallback.copy()

    if not mostly_unknown(primary):
        return primary

    try:
        bdc = requests.get(
            "https://geocode.maps.co/reverse",
            params={"lat": lat, "lon": lon},
            timeout=10,
        ).json()
        secondary = build_payload(bdc.get("address", {}), bdc.get("display_name", "Unknown"))
        if not mostly_unknown(secondary):
            return secondary
    except Exception:
        pass

    if OPENWEATHER_API_KEY:
        try:
            geo = requests.get(
                "http://api.openweathermap.org/geo/1.0/reverse",
                params={"lat": lat, "lon": lon, "limit": 1, "appid": OPENWEATHER_API_KEY},
                timeout=10,
            ).json()
            if isinstance(geo, list) and geo:
                g = geo[0]
                tertiary = {
                    "state": g.get("state", "Unknown"),
                    "district": g.get("state", "Unknown"),
                    "city": g.get("name", "Unknown"),
                    "village": g.get("name", "Unknown"),
                    "country": g.get("country", "Unknown"),
                    "display_name": g.get("name", "Unknown"),
                }
                if not mostly_unknown(tertiary):
                    return tertiary
        except Exception:
            pass

    if inside_india(lat, lon):
        primary["country"] = "India"
    return primary


def get_weather_payload(lat, lon):
    if not OPENWEATHER_API_KEY:
        return {
            "temperature": 29.4,
            "humidity": 76,
            "rainfall": 12.1,
            "pressure": 1009,
            "wind_speed": 3.4,
            "description": "Simulated Rain",
            "location": "India",
            "source": "simulated",
        }

    url = "https://api.openweathermap.org/data/2.5/weather"
    r = requests.get(
        url,
        params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"},
        timeout=10,
    )
    data = r.json()
    return {
        "temperature": data["main"]["temp"],
        "humidity": data["main"]["humidity"],
        "pressure": data["main"]["pressure"],
        "rainfall": data.get("rain", {}).get("1h", 0),
        "wind_speed": data["wind"]["speed"],
        "description": data["weather"][0]["description"],
        "location": data.get("name", "Unknown"),
        "source": "openweather",
    }


@app.route("/")
def home():
    return jsonify(
        {
            "message": "Flood Guard Backend Running",
            "weather_api": bool(OPENWEATHER_API_KEY),
            "news_api": bool(NEWSDATA_API_KEY),
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/health")
def health():
    return jsonify({"status": "online", "time": datetime.now().isoformat()})


@app.route("/api/weather")
def get_weather():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))
    try:
        return jsonify(get_weather_payload(lat, lon))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/location-intel")
def location_intel():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))
    try:
        weather = get_weather_payload(lat, lon)
        geo = reverse_geocode(lat, lon)
        return jsonify(
            {
                "lat": lat,
                "lon": lon,
                "state": geo["state"],
                "district": geo["district"],
                "city": geo["city"],
                "village": geo["village"],
                "country": geo["country"],
                "address": geo["display_name"],
                "inside_india": inside_india(lat, lon),
                "weather": weather,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict-risk", methods=["POST"])
def predict_risk():
    data = request.get_json() or {}
    rainfall = float(data.get("rainfall_mm_24h", 0))
    humidity = float(data.get("humidity", 0))
    temp = float(data.get("temperature_c", 25))
    lat = float(data.get("lat", 20.5937))
    lon = float(data.get("lon", 78.9629))
    wind_speed = float(data.get("wind_speed", 0))

    if not inside_india(lat, lon):
        lat, lon = 20.5937, 78.9629

    result = compute_prediction(rainfall, humidity, temp, lat, lon, wind_speed)
    return jsonify(result)


@app.route("/api/shelters")
def shelters():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))
    radius_km = float(request.args.get("radius_km", 15))
    items = fetch_shelters_data(lat, lon, radius_km)
    source = items[0].get("source", "openstreetmap") if items else "unknown"
    return jsonify({"count": len(items), "shelters": items, "source": source})


@app.route("/api/flood-hotspots")
def flood_hotspots():
    try:
        df = get_hotspot_df().copy()
        if "risk_score" in df.columns:
            df = df.sort_values(by="risk_score", ascending=False)

        hotspots = df.head(2600).to_dict(orient="records")
        return jsonify({"status": "success", "total_hotspots": len(df), "hotspots": hotspots})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/hotspots")
def hotspots_alias():
    return flood_hotspots()


@app.route("/api/readiness-score")
def readiness_score():
    try:
        ward_df = get_ward_df().copy()
        district_df = get_zone_df().copy()

        avg_score = round(float(ward_df["readiness_score"].mean()), 2)
        top = ward_df.sort_values(by="readiness_score", ascending=False).head(10)
        low = ward_df.sort_values(by="readiness_score", ascending=True).head(10)
        high_risk = ward_df[ward_df["risk_score"] >= 4.5]
        moderate_risk = ward_df[(ward_df["risk_score"] >= 3) & (ward_df["risk_score"] < 4.5)]

        deployment = []
        for _, r in low.head(8).iterrows():
            risk = float(r["risk_score"])
            pumps = 5 if risk >= 5 else (4 if risk >= 4 else 3)
            boats = 4 if risk >= 5 else (3 if risk >= 4 else 2)
            teams = 6 if risk >= 5 else (5 if risk >= 4 else 3)
            deployment.append(
                {
                    "ward_id": r["ward_id"],
                    "district": r["district"],
                    "risk_score": round(risk, 2),
                    "readiness_score": round(float(r["readiness_score"]), 2),
                    "drainage_capacity": round(float(r["drainage_capacity"]), 2),
                    "recommended_resources": {
                        "dewatering_pumps": pumps,
                        "rescue_boats": boats,
                        "response_teams": teams,
                    },
                }
            )

        return jsonify(
            {
                "avg_readiness": avg_score,
                "total_wards": len(ward_df),
                "total_districts": len(district_df),
                "high_risk_wards": int(len(high_risk)),
                "moderate_risk_wards": int(len(moderate_risk)),
                "top_prepared": top.to_dict(orient="records"),
                "needs_attention": low.to_dict(orient="records"),
                "deployment_plan": deployment,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/hotspot-analysis")
def hotspot_analysis():
    try:
        df = get_hotspot_df().copy()

        high = df[df["risk_score"] >= 5]
        moderate = df[(df["risk_score"] >= 3) & (df["risk_score"] < 5)]
        low = df[df["risk_score"] < 3]

        return jsonify(
            {
                "total_hotspots": len(df),
                "high_risk_zones": len(high),
                "moderate_risk_zones": len(moderate),
                "low_risk_zones": len(low),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/hydrology-engine-summary")
def hydrology_engine_summary():
    try:
        ward_df = get_ward_df().copy()
        high = ward_df[ward_df["risk_score"] >= 4.5]
        moderate = ward_df[(ward_df["risk_score"] >= 3) & (ward_df["risk_score"] < 4.5)]
        low = ward_df[ward_df["risk_score"] < 3]

        return jsonify(
            {
                "engine_name": "Urban Flooding & Hydrology Engine",
                "method": "GIS ward tessellation + rainfall/elevation/drainage fusion",
                "micro_hotspots_identified": int(len(ward_df)),
                "ward_level_ready": True,
                "features_used": [
                    "historical_rainfall_mm",
                    "terrain_elevation",
                    "drainage_capacity",
                    "ward_readiness_score",
                ],
                "risk_distribution": {
                    "high": int(len(high)),
                    "moderate": int(len(moderate)),
                    "low": int(len(low)),
                },
                "generated_at": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/flood-forecast")
def flood_forecast():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))

    try:
        if OPENWEATHER_API_KEY:
            r = requests.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"},
                timeout=12,
            )
            payload = r.json()
            rows = payload.get("list", [])[:16]  # 48 hours in 3-hour steps
            forecast = []
            for row in rows:
                rain_3h = row.get("rain", {}).get("3h", 0) or 0
                humidity = row.get("main", {}).get("humidity", 0) or 0
                if rain_3h > 20 or humidity > 90:
                    risk = "High Flood Risk"
                elif rain_3h > 8 or humidity > 80:
                    risk = "Moderate Risk"
                else:
                    risk = "Low Risk"

                forecast.append(
                    {
                        "timestamp": row.get("dt_txt"),
                        "rainfall_mm": round(float(rain_3h), 2),
                        "humidity": humidity,
                        "temp_c": row.get("main", {}).get("temp"),
                        "risk": risk,
                        "source": "openweather",
                    }
                )
            return jsonify({"forecast": forecast, "source": "openweather"})

        # Fallback when API key is absent.
        simulated = []
        for i in range(16):
            rain = round(6 + i * 1.2, 2)
            humidity = min(98, 68 + i)
            risk = "High Flood Risk" if rain > 20 else ("Moderate Risk" if rain > 10 else "Low Risk")
            simulated.append(
                {
                    "timestamp": f"+{i * 3}h",
                    "rainfall_mm": rain,
                    "humidity": humidity,
                    "temp_c": 27,
                    "risk": risk,
                    "source": "simulated",
                }
            )
        return jsonify({"forecast": simulated, "source": "simulated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alerts")
def flood_alerts():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))

    if not inside_india(lat, lon):
        lat, lon = 20.5937, 78.9629

    alerts = []
    now = datetime.now().isoformat()

    try:
        weather = get_weather_payload(lat, lon)
        prediction = compute_prediction(
            weather.get("rainfall", 0),
            weather.get("humidity", 0),
            weather.get("temperature", 25),
            lat,
            lon,
            weather.get("wind_speed", 0),
        )
        zone = nearest_zone_features(lat, lon)
        hotspot = hotspot_context(lat, lon)

        if prediction["predicted_risk_level"] >= 2:
            alerts.append(
                {
                    "severity": "high" if prediction["predicted_risk_level"] == 3 else "medium",
                    "title": "Flood Risk Elevated",
                    "message": (
                        f"Model risk is {prediction['risk_label']} ({prediction['confidence']}%). "
                        f"Nearest district: {zone['district']}."
                    ),
                    "time": now,
                    "source": "hydrology-engine-live",
                }
            )

        if weather.get("rainfall", 0) >= 25:
            alerts.append(
                {
                    "severity": "high",
                    "title": "Heavy Rainfall Observed",
                    "message": f"Current rainfall is {weather.get('rainfall', 0)} mm/h near your area.",
                    "time": now,
                    "source": weather.get("source", "weather"),
                }
            )

        if weather.get("wind_speed", 0) >= 12:
            alerts.append(
                {
                    "severity": "medium",
                    "title": "Strong Wind Advisory",
                    "message": f"Wind speed is {weather.get('wind_speed', 0)} m/s. Avoid low-visibility travel.",
                    "time": now,
                    "source": weather.get("source", "weather"),
                }
            )

        if hotspot["nearby_hotspots"] >= 40:
            alerts.append(
                {
                    "severity": "medium",
                    "title": "High Hotspot Density Nearby",
                    "message": (
                        f"{hotspot['nearby_hotspots']} mapped hotspots nearby "
                        f"(avg risk {hotspot['avg_risk_score']})."
                    ),
                    "time": now,
                    "source": "hydrology-engine-live",
                }
            )

        if zone["readiness_score"] < 55:
            alerts.append(
                {
                    "severity": "medium",
                    "title": "Low Readiness Zone",
                    "message": (
                        f"{zone['district']} readiness score is {zone['readiness_score']}. "
                        "Prepare emergency kit and evacuation plan."
                    ),
                    "time": now,
                    "source": "hydrology-engine-live",
                }
            )

        if OPENWEATHER_API_KEY:
            f = requests.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"},
                timeout=10,
            ).json()
            next_slots = f.get("list", [])[:8]
            forecast_peaks = [
                (slot.get("rain", {}).get("3h", 0) or 0, slot.get("dt_txt", "unknown"))
                for slot in next_slots
            ]
            heavy = [x for x in forecast_peaks if x[0] >= 20]
            if heavy:
                alerts.append(
                    {
                        "severity": "high",
                        "title": "Forecast Heavy Rain in Next 24h",
                        "message": f"Expected up to {max(heavy, key=lambda x: x[0])[0]} mm/3h around {heavy[0][1]}.",
                        "time": now,
                        "source": "forecast-engine-live",
                    }
                )

        if not alerts:
            alerts.append(
                {
                    "severity": "low",
                    "title": "No Immediate Flood Alert",
                    "message": "Current conditions are stable. Continue monitoring forecast updates.",
                    "time": now,
                    "source": "hydrology-engine-live",
                }
            )

        return jsonify(
            {
                "status": "success",
                "location": {"lat": lat, "lon": lon, "district": zone["district"]},
                "alerts": alerts[:8],
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/action-plan")
def action_plan():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))
    if not inside_india(lat, lon):
        lat, lon = 20.5937, 78.9629

    try:
        weather = get_weather_payload(lat, lon)
        prediction = compute_prediction(
            weather.get("rainfall", 0),
            weather.get("humidity", 0),
            weather.get("temperature", 25),
            lat,
            lon,
            weather.get("wind_speed", 0),
        )
        ward = nearest_ward_features(lat, lon)
        shelters = fetch_shelters_data(lat, lon, 20)[:5]

        severity = "low"
        if prediction["predicted_risk_level"] >= 3 or ward["ward_risk_score"] >= 5:
            severity = "high"
        elif prediction["predicted_risk_level"] >= 2 or ward["ward_risk_score"] >= 4:
            severity = "medium"

        citizen_actions = [
            "Keep phone charged and emergency torch ready.",
            "Store drinking water and 48-hour essential medicines.",
            "Avoid parking vehicles in low-lying roads/drain zones.",
        ]
        authority_actions = [
            "Inspect and clear clogged drains in vulnerable wards.",
            "Pre-position dewatering pumps in top-risk hotspots.",
            "Keep ward-level response teams and rescue boats on standby.",
        ]
        if severity == "high":
            citizen_actions = [
                "Move valuables to upper floors and prepare evacuation bag.",
                "Avoid non-essential travel in flood-prone stretches.",
                "Stay connected to district control room updates every 3-4 hours.",
            ]
            authority_actions = [
                "Deploy pumps and barricades in identified micro-hotspots immediately.",
                "Issue ward-level advisories and activate emergency shelters.",
                "Keep medical rapid response and rescue units in forward staging.",
            ]

        return jsonify(
            {
                "status": "success",
                "severity": severity,
                "location": {
                    "lat": lat,
                    "lon": lon,
                    "district": ward["district"],
                    "ward_id": ward["ward_id"],
                },
                "key_metrics": {
                    "predicted_risk_label": prediction["risk_label"],
                    "confidence": prediction["confidence"],
                    "ward_risk_score": ward["ward_risk_score"],
                    "ward_readiness_score": ward["readiness_score"],
                    "drainage_capacity": ward["drainage_capacity"],
                    "rainfall_now_mm": weather.get("rainfall", 0),
                    "humidity_now": weather.get("humidity", 0),
                    "wind_speed_now": weather.get("wind_speed", 0),
                },
                "citizen_actions": citizen_actions,
                "authority_actions": authority_actions,
                "nearest_safe_places": shelters,
                "generated_at": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/safe-route")
def safe_route():
    lat = float(request.args.get("lat", 20.5937))
    lon = float(request.args.get("lon", 78.9629))
    target_lat = request.args.get("target_lat")
    target_lon = request.args.get("target_lon")
    target_name = request.args.get("target_name", "").strip()

    if not inside_india(lat, lon):
        lat, lon = 20.5937, 78.9629

    target = None
    if target_lat is not None and target_lon is not None:
        to_lat = float(target_lat)
        to_lon = float(target_lon)
        target = {
            "name": target_name or "Selected Safe Place",
            "type": "selected",
            "distance_km": round(haversine_km(lat, lon, to_lat, to_lon), 2),
            "latitude": to_lat,
            "longitude": to_lon,
            "source": "user-selected",
        }
    else:
        shelters = fetch_shelters_data(lat, lon, 35)
        valid = [
            s
            for s in shelters
            if s.get("latitude") is not None and s.get("longitude") is not None
        ]
        if not valid:
            return jsonify({"status": "error", "message": "No shelter coordinates available."}), 404

        valid.sort(
            key=lambda s: float(s.get("distance_km", haversine_km(lat, lon, s["latitude"], s["longitude"])))
        )
        target = valid[0]
        to_lat = float(target["latitude"])
        to_lon = float(target["longitude"])

    try:
        osrm = requests.get(
            "https://router.project-osrm.org/route/v1/driving/"
            f"{lon},{lat};{to_lon},{to_lat}?overview=full&geometries=geojson",
            timeout=12,
        ).json()
        route = osrm.get("routes", [None])[0]
        if not route:
            raise ValueError("No OSRM route")

        coordinates = [[p[1], p[0]] for p in route["geometry"]["coordinates"]]
        return jsonify(
            {
                "status": "success",
                "mode": "osrm",
                "target": target,
                "distance_km": round(float(route["distance"]) / 1000, 2),
                "duration_min": round(float(route["duration"]) / 60),
                "coordinates": coordinates,
            }
        )
    except Exception:
        mid_lat = round((lat + to_lat) / 2 + 0.03, 6)
        mid_lon = round((lon + to_lon) / 2 - 0.03, 6)
        distance_km = round(haversine_km(lat, lon, to_lat, to_lon), 2)
        duration_min = max(5, round(distance_km / 35 * 60))

        return jsonify(
            {
                "status": "success",
                "mode": "fallback",
                "target": target,
                "distance_km": distance_km,
                "duration_min": duration_min,
                "coordinates": [[lat, lon], [mid_lat, mid_lon], [to_lat, to_lon]],
            }
        )


def fallback_news_by_lang(lang):
    bank = {
        "en": [
            ("Heavy rainfall warning in multiple Indian states", "Authorities advise residents in low-lying areas to stay alert."),
            ("Urban flooding risk rises ahead of monsoon spell", "Drain cleaning and pumping teams are being pre-positioned."),
            ("District control rooms activated for flood preparedness", "Emergency response teams are on standby."),
        ],
        "hi": [
            ("कई राज्यों में भारी बारिश की चेतावनी", "निचले इलाकों के लोगों को सतर्क रहने की सलाह दी गई है।"),
            ("मानसून से पहले शहरी बाढ़ का खतरा बढ़ा", "नालों की सफाई और पंपिंग टीमें तैनात की जा रही हैं।"),
            ("बाढ़ तैयारी के लिए जिला नियंत्रण कक्ष सक्रिय", "आपदा प्रतिक्रिया दल अलर्ट पर हैं।"),
        ],
        "ta": [
            ("பல மாநிலங்களில் கனமழை எச்சரிக்கை", "தாழ்வான பகுதிகளில் உள்ளவர்கள் எச்சரிக்கையாக இருக்க அறிவுரை."),
            ("முன்கூட்டியே நகர வெள்ள ஆபத்து உயர்வு", "வடிகால் சுத்தம் மற்றும் பம்ப் அணிகள் முன்கூட்டியே நியமனம்."),
            ("வெள்ள தயார் பணிக்காக கட்டுப்பாட்டு அறைகள் செயல்பாடு", "அவசர அணிகள் தயார் நிலையில் உள்ளன."),
        ],
        "kn": [
            ("ಹೆಚ್ಚಿನ ಮಳೆಯ ಎಚ್ಚರಿಕೆ ಹಲವು ರಾಜ್ಯಗಳಲ್ಲಿ", "ತಗ್ಗು ಪ್ರದೇಶದ ನಿವಾಸಿಗಳು ಎಚ್ಚರಿಕೆಯಿಂದ ಇರಲು ಸೂಚನೆ."),
            ("ಮಳೆಗಾಲದ ಮುನ್ನ ನಗರ ಪ್ರವಾಹ ಅಪಾಯ ಹೆಚ್ಚಳ", "ಡ್ರೆನೇಜ್ ಸ್ವಚ್ಛತೆ ಮತ್ತು ಪಂಪ್ ತಂಡಗಳು ನಿಯೋಜನೆ."),
            ("ಪ್ರವಾಹ ಸಿದ್ಧತೆಗೆ ಜಿಲ್ಲಾ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗಳು ಸಕ್ರಿಯ", "ತುರ್ತು ಪ್ರತಿಕ್ರಿಯಾ ತಂಡಗಳು ಸಿದ್ಧವಾಗಿವೆ."),
        ],
        "te": [
            ("అనేక రాష్ట్రాల్లో భారీ వర్ష హెచ్చరిక", "తక్కువ ఎత్తు ప్రాంతాల ప్రజలు అప్రమత్తంగా ఉండాలని సూచన."),
            ("మాన్సూన్ ముందు నగర వరద ప్రమాదం పెరుగుతోంది", "డ్రైనేజ్ శుభ్రత, పంపింగ్ బృందాల ముందస్తు మోహరింపు."),
            ("వరద సిద్ధత కోసం జిల్లా కంట్రోల్ రూమ్స్ సక్రియం", "ఎమర్జెన్సీ బృందాలు సిద్ధంగా ఉన్నాయి."),
        ],
        "mr": [
            ("अनेक राज्यांत मुसळधार पावसाचा इशारा", "सखल भागातील नागरिकांनी सतर्क राहावे अशी सूचना."),
            ("मान्सूनपूर्व शहरी पूर धोका वाढला", "नालेसफाई व पंपिंग पथके पूर्वतयारीत."),
            ("पूर तयारीसाठी जिल्हा नियंत्रण कक्ष सक्रिय", "आपत्कालीन पथके सज्ज ठेवण्यात आली आहेत."),
        ],
        "bn": [
            ("একাধিক রাজ্যে ভারী বৃষ্টির সতর্কতা", "নিম্নাঞ্চলের বাসিন্দাদের সতর্ক থাকার পরামর্শ।"),
            ("বর্ষার আগে শহুরে জলাবদ্ধতার ঝুঁকি বাড়ছে", "ড্রেন পরিষ্কার ও পাম্পিং দল মোতায়েন করা হচ্ছে।"),
            ("বন্যা প্রস্তুতিতে জেলা কন্ট্রোল রুম সক্রিয়", "জরুরি প্রতিক্রিয়া দল প্রস্তুত রয়েছে।"),
        ],
    }
    picks = bank.get(lang, bank["en"])
    return [{"title": t, "description": d, "source": "floodguard-news"} for t, d in picks]


@app.route("/api/hotspot-satellite")
def hotspot_satellite():
    limit = int(request.args.get("limit", 6))
    limit = max(1, min(limit, 12))
    try:
        df = get_hotspot_df().copy()
        if "risk_score" in df.columns:
            df = df.sort_values(by="risk_score", ascending=False)

        picks = df.head(limit).to_dict(orient="records")
        items = []
        for h in picks:
            lat = float(h["latitude"])
            lon = float(h["longitude"])
            delta = 0.03
            bbox = f"{lon-delta},{lat-delta},{lon+delta},{lat+delta}"
            sat_image_url = (
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
                f"?bbox={bbox}&bboxSR=4326&imageSR=4326&size=640,360&format=jpg&f=image"
            )
            viewer_url = f"https://www.google.com/maps?q={lat},{lon}&t=k&z=14"
            items.append(
                {
                    "district": h.get("district", "Unknown"),
                    "ward_id": h.get("ward_id", "N/A"),
                    "risk_score": h.get("risk_score", 0),
                    "latitude": lat,
                    "longitude": lon,
                    "satellite_image_url": sat_image_url,
                    "viewer_url": viewer_url,
                }
            )

        return jsonify({"status": "success", "images": items, "source": "arcgis-world-imagery"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/news")
def get_news():
    lang = (request.args.get("lang", "en") or "en").lower()
    if lang not in {"en", "hi", "ta", "kn", "te", "mr", "bn"}:
        lang = "en"

    if NEWSDATA_API_KEY:
        try:
            resp = requests.get(
                "https://newsdata.io/api/1/latest",
                params={
                    "apikey": NEWSDATA_API_KEY,
                    "q": "flood OR rainfall OR urban flooding OR monsoon",
                    "country": "in",
                    "language": lang,
                    "size": 8,
                },
                timeout=12,
            )
            payload = resp.json()
            rows = payload.get("results", [])
            if rows:
                parsed = []
                for r in rows:
                    parsed.append(
                        {
                            "title": r.get("title", "Flood update"),
                            "description": r.get("description") or r.get("content") or "No description",
                            "link": r.get("link", ""),
                            "source": r.get("source_id", "newsdata"),
                        }
                    )
                return jsonify({"results": parsed, "lang": lang, "source": "newsdata"})
        except Exception:
            pass

    return jsonify({"results": fallback_news_by_lang(lang), "lang": lang, "source": "fallback"})


@app.route("/api/db/status")
def db_status():
    status = dict(DB_BOOTSTRAP)
    if mysql_enabled() and status.get("schema_ready"):
        try:
            status["connected"] = db_repo.ping()
        except Exception as e:
            status["connected"] = False
            status["message"] = str(e)
    else:
        status["connected"] = False
    return jsonify(status)


@app.route("/api/account/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Name, email, and password(>=6 chars) are required."}), 400

    if mysql_enabled() and DB_BOOTSTRAP.get("schema_ready"):
        try:
            existing = db_repo.get_user_by_email(email)
            if existing:
                return jsonify({"error": "Email already registered."}), 409
            db_repo.create_user(
                str(uuid4()),
                name,
                email,
                generate_password_hash(password),
                datetime.now(),
            )
        except Exception as e:
            return jsonify({"error": f"MySQL register failed: {e}"}), 500
    else:
        users = load_users()
        if any(u["email"] == email for u in users):
            return jsonify({"error": "Email already registered."}), 409
        user = {
            "id": str(uuid4()),
            "name": name,
            "email": email,
            "password_hash": generate_password_hash(password),
            "created_at": datetime.now().isoformat(),
        }
        users.append(user)
        save_users(users)

    return jsonify({"message": "Account created.", "user": {"name": name, "email": email}})


@app.route("/api/account/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if mysql_enabled() and DB_BOOTSTRAP.get("schema_ready"):
        try:
            user = db_repo.get_user_by_email(email)
            if not user or not check_password_hash(user["password_hash"], password):
                return jsonify({"error": "Invalid credentials."}), 401
            token = str(uuid4())
            db_repo.create_session(token, user["id"], user["email"], user["name"], datetime.now())
            return jsonify(
                {
                    "message": "Login successful.",
                    "token": token,
                    "user": {"name": user["name"], "email": user["email"]},
                }
            )
        except Exception as e:
            return jsonify({"error": f"MySQL login failed: {e}"}), 500
    else:
        users = load_users()
        user = next((u for u in users if u["email"] == email), None)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials."}), 401
        token = str(uuid4())
        SESSIONS[token] = {"user_id": user["id"], "email": user["email"], "name": user["name"]}
        return jsonify(
            {
                "message": "Login successful.",
                "token": token,
                "user": {"name": user["name"], "email": user["email"]},
            }
        )


@app.route("/api/account/profile")
def profile():
    token = request.args.get("token", "")
    if mysql_enabled() and DB_BOOTSTRAP.get("schema_ready"):
        try:
            session = db_repo.get_session(token)
        except Exception as e:
            return jsonify({"error": f"MySQL profile failed: {e}"}), 500
    else:
        session = SESSIONS.get(token)
    if not session:
        return jsonify({"error": "Unauthorized."}), 401
    return jsonify({"user": {"name": session["name"], "email": session["email"]}})


@app.route("/api/account/logout", methods=["POST"])
def logout():
    data = request.get_json() or {}
    token = data.get("token", "")
    if mysql_enabled() and DB_BOOTSTRAP.get("schema_ready"):
        try:
            db_repo.delete_session(token)
        except Exception as e:
            return jsonify({"error": f"MySQL logout failed: {e}"}), 500
    else:
        SESSIONS.pop(token, None)
    return jsonify({"message": "Logged out."})


@app.route("/api/community/volunteers", methods=["GET", "POST"])
def community_volunteers():
    if not (mysql_enabled() and DB_BOOTSTRAP.get("schema_ready")):
        return jsonify({"error": "MySQL not configured"}), 503
    if request.method == "GET":
        try:
            rows = db_repo.list_volunteers(limit=int(request.args.get("limit", 100)))
            return jsonify({"volunteers": rows})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    area = (data.get("area") or "").strip()
    skill = (data.get("skill") or "rescue").strip()
    lat = data.get("lat")
    lon = data.get("lon")
    if not name or not phone or not area:
        return jsonify({"error": "name, phone, area are required"}), 400
    try:
        rid = db_repo.add_volunteer(name, phone, area, skill, lat, lon, datetime.now())
        return jsonify({"message": "Volunteer saved", "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/community/requests", methods=["GET", "POST"])
def community_requests():
    if not (mysql_enabled() and DB_BOOTSTRAP.get("schema_ready")):
        return jsonify({"error": "MySQL not configured"}), 503
    if request.method == "GET":
        try:
            rows = db_repo.list_help_requests(limit=int(request.args.get("limit", 100)))
            return jsonify({"requests": rows})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    data = request.get_json() or {}
    text = (data.get("request_text") or "").strip()
    priority = (data.get("priority") or "medium").strip().lower()
    area = (data.get("area") or "").strip()
    lat = data.get("lat")
    lon = data.get("lon")
    if not text or not area:
        return jsonify({"error": "request_text and area are required"}), 400
    status = "open"
    try:
        rid = db_repo.add_help_request(text, priority, area, status, lat, lon, datetime.now())
        return jsonify({"message": "Request saved", "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/community/requests/resolve", methods=["POST"])
def community_resolve_request():
    if not (mysql_enabled() and DB_BOOTSTRAP.get("schema_ready")):
        return jsonify({"error": "MySQL not configured"}), 503
    data = request.get_json() or {}
    req_id = data.get("id")
    if not req_id:
        return jsonify({"error": "id is required"}), 400
    try:
        db_repo.resolve_help_request(int(req_id))
        return jsonify({"message": "Request resolved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/events", methods=["GET", "POST"])
def history_events():
    if not (mysql_enabled() and DB_BOOTSTRAP.get("schema_ready")):
        return jsonify({"error": "MySQL not configured"}), 503
    if request.method == "GET":
        try:
            rows = db_repo.list_history_events(limit=int(request.args.get("limit", 200)))
            return jsonify({"events": rows})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    data = request.get_json() or {}
    event_type = (data.get("event_type") or "").strip()
    message = (data.get("message") or "").strip()
    lat = data.get("lat")
    lon = data.get("lon")
    if not event_type or not message:
        return jsonify({"error": "event_type and message are required"}), 400
    try:
        eid = db_repo.add_history_event(event_type, message, lat, lon, datetime.now())
        return jsonify({"message": "History event saved", "id": eid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Backend running at http://127.0.0.1:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
