import pandas as pd

# ================================
# LOAD DATASETS
# ================================

rain = pd.read_csv("../data/Daily-rainfall-at-state-level.csv")

elev = pd.read_csv("../data/Districts_elevation.csv")

# ================================
# CLEAN DATA
# ================================

rain = rain.rename(columns={
    "state_name": "state",
    "actual": "rainfall_mm"
})

elev = elev.rename(columns={
    "District": "district",
    "Latitude": "latitude",
    "Longitude": "longitude"
})

# ================================
# AGGREGATE RAINFALL BY STATE
# ================================

rain_state = rain.groupby("state")["rainfall_mm"].mean().reset_index()

# ================================
# CREATE FLOOD RISK SCORE
# ================================

hotspots = elev.copy()

hotspots["terrain_risk"] = hotspots["elevation"].apply(
    lambda x: "High" if x < 100 else
              "Moderate" if x < 300 else
              "Low"
)

# assign rainfall randomly by matching states later
hotspots["rainfall_risk"] = "Moderate"

# ================================
# FINAL HOTSPOT SCORE
# ================================

def risk_score(row):

    score = 0

    if row["terrain_risk"] == "High":
        score += 2
    elif row["terrain_risk"] == "Moderate":
        score += 1

    if row["rainfall_risk"] == "High":
        score += 2
    elif row["rainfall_risk"] == "Moderate":
        score += 1

    return score


hotspots["risk_score"] = hotspots.apply(risk_score, axis=1)

# ================================
# SAVE HOTSPOTS
# ================================

hotspots = hotspots.sort_values("risk_score", ascending=False)

hotspots.to_csv("../data/india_flood_micro_hotspots.csv", index=False)

print("Hotspots generated:", len(hotspots))