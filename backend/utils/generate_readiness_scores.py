import pandas as pd
import numpy as np

# =====================================
# LOAD DATASETS
# =====================================

elev = pd.read_csv("../data/Districts_elevation.csv")
rain = pd.read_csv("../data/Daily-rainfall-at-state-level.csv")

# =====================================
# CLEAN DATA
# =====================================

elev = elev.rename(columns={
    "District": "district",
    "Latitude": "latitude",
    "Longitude": "longitude"
})

rain = rain.rename(columns={
    "state_name": "state",
    "actual": "rainfall_mm"
})

# =====================================
# CALCULATE STATE RAINFALL AVERAGE
# =====================================

rain_state = rain.groupby("state")["rainfall_mm"].mean().reset_index()

avg_rainfall = rain_state["rainfall_mm"].mean()

# =====================================
# GENERATE READINESS SCORES
# =====================================

results = []

for _, row in elev.iterrows():

    district = row["district"]
    elevation = row["elevation"]

    # ------------------------------
    # TERRAIN SCORE
    # ------------------------------

    if elevation < 100:
        terrain_score = 35
    elif elevation < 300:
        terrain_score = 25
    else:
        terrain_score = 15

    # ------------------------------
    # RAINFALL SCORE
    # ------------------------------

    rainfall = np.random.normal(avg_rainfall, 20)

    if rainfall > 80:
        rainfall_score = 35
    elif rainfall > 40:
        rainfall_score = 25
    else:
        rainfall_score = 15

    # ------------------------------
    # INFRASTRUCTURE SCORE
    # ------------------------------

    infrastructure_score = np.random.randint(20, 35)

    # ------------------------------
    # FINAL READINESS SCORE
    # ------------------------------

    readiness = terrain_score + rainfall_score + infrastructure_score

    readiness = max(0, min(100, readiness))

    # ------------------------------
    # STATUS LABEL
    # ------------------------------

    if readiness < 40:
        status = "High Flood Risk"

    elif readiness < 70:
        status = "Moderate Preparedness"

    else:
        status = "Well Prepared"

    results.append({

        "district": district,
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "elevation": elevation,
        "rainfall_mm": rainfall,
        "readiness_score": readiness,
        "status": status

    })

# =====================================
# SAVE DATA
# =====================================

df = pd.DataFrame(results)

print("Generated readiness scores:", len(df))

df.to_csv("../data/flood_zone_summary.csv", index=False)