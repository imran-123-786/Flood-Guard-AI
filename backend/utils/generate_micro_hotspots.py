import pandas as pd
import numpy as np

# ======================================
# LOAD DATASETS
# ======================================

elev = pd.read_csv("../data/Districts_elevation.csv")
rain = pd.read_csv("../data/Daily-rainfall-at-state-level.csv")

# ======================================
# CLEAN DATA
# ======================================

elev = elev.rename(columns={
    "District": "district",
    "Latitude": "latitude",
    "Longitude": "longitude"
})

rain = rain.rename(columns={
    "state_name": "state",
    "actual": "rainfall_mm"
})

# ======================================
# COMPUTE STATE RAINFALL AVERAGE
# ======================================

rain_state = rain.groupby("state")["rainfall_mm"].mean().reset_index()

avg_rainfall = rain_state["rainfall_mm"].mean()

# ======================================
# INDIA GRID CREATION
# ======================================

lat_range = np.arange(8, 37, 0.5)
lon_range = np.arange(68, 97, 0.5)

points = []

# ======================================
# GENERATE MICRO HOTSPOTS
# ======================================

for lat in lat_range:
    for lon in lon_range:

        # nearest elevation sample
        sample = elev.sample(1).iloc[0]
        elevation = sample["elevation"]

        # -------------------------
        # TERRAIN RISK
        # -------------------------

        if elevation < 100:
            terrain = "High"
            terrain_score = 3

        elif elevation < 300:
            terrain = "Moderate"
            terrain_score = 2

        else:
            terrain = "Low"
            terrain_score = 1

        # -------------------------
        # RAINFALL RISK
        # -------------------------

        rainfall = np.random.normal(avg_rainfall, 20)

        if rainfall > 80:
            rain_risk = "High"
            rain_score = 3

        elif rainfall > 40:
            rain_risk = "Moderate"
            rain_score = 2

        else:
            rain_risk = "Low"
            rain_score = 1

        # -------------------------
        # FINAL RISK SCORE
        # -------------------------

        risk_score = terrain_score + rain_score

        points.append({

            "district": "Micro Zone",
            "latitude": lat,
            "longitude": lon,
            "elevation": elevation,
            "rainfall_mm": rainfall,
            "terrain_risk": terrain,
            "rainfall_risk": rain_risk,
            "risk_score": risk_score

        })

# ======================================
# SAVE DATA
# ======================================

hotspots = pd.DataFrame(points)

print("Generated micro hotspots:", len(hotspots))

hotspots.to_csv("../data/india_flood_micro_hotspots.csv", index=False)