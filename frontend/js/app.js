const BACKEND_URL = "http://127.0.0.1:5000";

const INDIA_BOUNDS = {
  latMin: 6.0,
  latMax: 38.5,
  lonMin: 68.0,
  lonMax: 97.5,
};

let userLat = 20.5937;
let userLon = 78.9629;
let activeLat = 20.5937;
let activeLon = 78.9629;
let map = null;
let routeMap = null;
let appStarted = false;
let latestWeather = null;
let hotspotLayer = null;
let heatLayer = null;
let userMarker = null;
let routeLayer = null;
let routeTargetMarker = null;
let routeUserMarker = null;
let sheltersCache = [];
let routeOptionsCache = [];
let latestLocationIntel = null;
const HISTORY_KEY = "fg_history_events";
const VOLUNTEER_KEY = "fg_community_volunteers";
const REQUEST_KEY = "fg_community_requests";
const SOS_CONTACTS_NATIONAL = [
  { name: "National Emergency Response", number: "112", note: "Police, Fire, Ambulance" },
  { name: "National Disaster Helpline", number: "1078", note: "Flood and disaster support" },
  { name: "Ambulance", number: "108", note: "Medical emergency" },
  { name: "Disaster Control Room", number: "1070", note: "State disaster control room" },
];
const SOS_STATE_CONTROL_ROOMS = {
  "Uttar Pradesh": "1070",
  Maharashtra: "1077",
  Karnataka: "1070",
  "Tamil Nadu": "1070",
  Kerala: "1077",
  Telangana: "1070",
  Gujarat: "1077",
  Bihar: "1070",
  "West Bengal": "1070",
  Rajasthan: "1070",
};

const accountState = {
  token: localStorage.getItem("fg_token") || "",
  user: null,
};

function insideIndia(lat, lon) {
  return lat >= INDIA_BOUNDS.latMin && lat <= INDIA_BOUNDS.latMax && lon >= INDIA_BOUNDS.lonMin && lon <= INDIA_BOUNDS.lonMax;
}

function showSection(id) {
  document.querySelectorAll(".section").forEach((sec) => sec.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  document.querySelectorAll(".nav-menu button").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = Array.from(document.querySelectorAll(".nav-menu button")).find((btn) => btn.getAttribute("onclick") === `showSection('${id}')`);
  if (activeBtn) activeBtn.classList.add("active");

  if (id === "dashboard" && map) {
    setTimeout(() => map.invalidateSize(), 80);
  }
  if (id === "alerts") loadAlerts();
  if (id === "hotspots") loadHotspotAnalytics();
  if (id === "readiness") loadReadiness();
  if (id === "action") loadActionPlan();
  if (id === "community") renderCommunity();
  if (id === "history") renderHistory();
  if (id === "route") {
    ensureRouteMap();
    loadRouteOptions();
    setTimeout(() => {
      if (routeMap) routeMap.invalidateSize();
    }, 80);
  }
  if (id === "radar") {
    loadRadarSource();
    loadRadarInsights();
  }
  if (id === "rescue") loadSOSPanel();
  if (id === "account") renderAccount();
}
window.showSection = showSection;

window.addEventListener("DOMContentLoaded", () => {
  setupRouteControls();
  setupRadarControls();
  loadRadarSource();
  initCommunity();
  renderHistory();
  initLocation();
  if (accountState.token) fetchProfile();
});

function requestLocation() {
  initLocation(true);
}
window.requestLocation = requestLocation;

function initLocation(userRequested = false) {
  if (!navigator.geolocation) {
    updateLocationText("GPS not supported, using India default");
    startOrRefreshApp();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (insideIndia(lat, lon)) {
        userLat = lat;
        userLon = lon;
        setActiveLocation(userLat, userLon, "Live");
      } else {
        userLat = 20.5937;
        userLon = 78.9629;
        setActiveLocation(userLat, userLon, "India fallback");
      }

      startOrRefreshApp();
    },
    () => {
      if (userRequested) {
        updateLocationText("Location blocked, using India default");
      }
      startOrRefreshApp();
    },
    { enableHighAccuracy: true, timeout: 6000 }
  );
}

function updateLocationText(text) {
  const loc = document.getElementById("user-location");
  if (loc) loc.innerText = text;
}

function setActiveLocation(lat, lon, label = "") {
  activeLat = lat;
  activeLon = lon;
  const suffix = label ? ` | ${label}` : "";
  updateLocationText(`${activeLat.toFixed(4)}, ${activeLon.toFixed(4)}${suffix}`);
  if (routeUserMarker && routeMap) routeUserMarker.setLatLng([activeLat, activeLon]);
}

function getStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStoredArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function addHistoryEvent(type, message) {
  const events = getStoredArray(HISTORY_KEY);
  events.unshift({
    id: Date.now(),
    type,
    message,
    lat: Number(activeLat.toFixed(4)),
    lon: Number(activeLon.toFixed(4)),
    time: new Date().toISOString(),
  });
  setStoredArray(HISTORY_KEY, events.slice(0, 300));
}

function refreshAreaData() {
  fetchWeather();
  fetchShelters();
  loadFloodHotspots();
  loadFloodHeatmap();
  loadHotspotAnalytics();
  loadReadiness();
  loadAlerts();
  loadActionPlan();
  loadNews();
  loadRadarInsights();
  loadSOSPanel();
  if (document.getElementById("route-options")) loadRouteOptions();
}

function startOrRefreshApp() {
  if (!appStarted) {
    initMap();
    setupMapClick();
    monitorBattery();
    appStarted = true;
  } else {
    map.setView([userLat, userLon], 6);
    if (userMarker) userMarker.setLatLng([userLat, userLon]);
    if (routeUserMarker) routeUserMarker.setLatLng([activeLat, activeLon]);
  }
  refreshAreaData();
}

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 3,
    maxZoom: 18,
    scrollWheelZoom: true,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
  }).setView([userLat, userLon], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  userMarker = L.marker([userLat, userLon]).addTo(map).bindPopup("Your Location");
  hotspotLayer = L.layerGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 400);
}

function ensureRouteMap() {
  if (routeMap) {
    if (routeUserMarker) routeUserMarker.setLatLng([activeLat, activeLon]);
    return;
  }

  const routeEl = document.getElementById("route-map");
  if (!routeEl) return;

  routeMap = L.map("route-map", {
    zoomControl: true,
    minZoom: 3,
    maxZoom: 18,
  }).setView([activeLat, activeLon], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(routeMap);

  routeUserMarker = L.marker([activeLat, activeLon]).addTo(routeMap).bindPopup("Selected Location");
}

async function fetchWeather() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/weather?lat=${activeLat}&lon=${activeLon}`);
    const data = await res.json();
    latestWeather = data;

    const t = document.getElementById("temp");
    const r = document.getElementById("rain");
    const h = document.getElementById("humidity");
    const w = document.getElementById("wind");

    if (t) t.innerText = `${data.temperature ?? "--"}°C`;
    if (r) r.innerText = `${data.rainfall ?? 0} mm`;
    if (h) h.innerText = `${data.humidity ?? "--"}%`;
    if (w) w.innerText = `${data.wind_speed ?? "--"} m/s`;

    updateRiskFromWeather(data);
  } catch (e) {
    console.log("Weather error", e);
  }
}

function updateRiskFromWeather(data) {
  const rain = data.rainfall || 0;
  const hum = data.humidity || 0;

  let level = "Low";
  let color = "green";

  if (rain > 80 || hum > 90) {
    level = "High";
    color = "red";
  } else if (rain > 40 || hum > 80) {
    level = "Moderate";
    color = "orange";
  }

  const text = document.getElementById("risk-text");
  const box = document.getElementById("risk-color");
  if (text) text.innerText = level;
  if (box) box.style.background = color;
}

function monitorBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then((battery) => {
    const update = () => {
      const level = Math.round(battery.level * 100);
      const el = document.getElementById("battery-status");
      if (el) el.innerText = `${level}%`;
    };
    battery.addEventListener("levelchange", update);
    update();
  });
}

async function loadFloodHotspots() {
  if (!map || !hotspotLayer) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/flood-hotspots`);
    const data = await res.json();
    if (!Array.isArray(data.hotspots)) return;

    hotspotLayer.clearLayers();

    const visibleHotspots = pickDisplayHotspots(data.hotspots);
    visibleHotspots.forEach((h) => {
      const lat = parseFloat(h.latitude);
      const lon = parseFloat(h.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon) || !isStrictIndia(lat, lon)) return;

      let color = "green";
      if (h.risk_score >= 5) color = "red";
      else if (h.risk_score >= 3) color = "orange";

      L.circleMarker([lat, lon], {
        radius: h.risk_score >= 5 ? 5 : 3,
        color,
        fillColor: color,
        fillOpacity: 0.55,
      })
        .bindPopup(`Flood Hotspot<br>District: ${h.district || "Unknown"}<br>Risk Score: ${h.risk_score ?? "N/A"}`)
        .addTo(hotspotLayer);
    });
  } catch (err) {
    console.log("Hotspot error", err);
  }
}

async function loadFloodHeatmap() {
  if (!map || !L.heatLayer) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/flood-hotspots`);
    const data = await res.json();
    if (!Array.isArray(data.hotspots)) return;

    const heatPoints = [];
    const visibleHotspots = pickDisplayHotspots(data.hotspots);
    visibleHotspots.forEach((h) => {
      const lat = parseFloat(h.latitude);
      const lon = parseFloat(h.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon) || !isStrictIndia(lat, lon)) return;

      let weight = 0.3;
      if (h.risk_score >= 5) weight = 1;
      else if (h.risk_score >= 3) weight = 0.7;

      heatPoints.push([lat, lon, weight]);
    });

    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.heatLayer(heatPoints, {
      radius: 24,
      blur: 18,
      maxZoom: 11,
    }).addTo(map);
  } catch (e) {
    console.log("Heatmap error", e);
  }
}

function pickDisplayHotspots(hotspots) {
  const filtered = hotspots.filter((h) => {
    const lat = parseFloat(h.latitude);
    const lon = parseFloat(h.longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon) && isStrictIndia(lat, lon);
  });
  filtered.sort((a, b) => (parseFloat(b.risk_score) || 0) - (parseFloat(a.risk_score) || 0));
  if (filtered.length <= 700) return filtered;
  const step = Math.ceil(filtered.length / 700);
  return filtered.filter((_, idx) => idx % step === 0);
}

function isStrictIndia(lat, lon) {
  return lat >= 7.5 && lat <= 37.2 && lon >= 68.0 && lon <= 96.2;
}

function setupMapClick() {
  if (!map) return;
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    try {
      const res = await fetch(`${BACKEND_URL}/api/location-intel?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      const weather = data.weather || {};
      const cityName = data.city && data.city !== "Unknown" ? data.city : weather.location || "Unknown";
      const countryName = (data.country || "Unknown") === "IN" ? "India" : data.country || "Unknown";
      latestLocationIntel = data;
      setActiveLocation(lat, lon, `${data.state || "Selected Area"}`);
      addHistoryEvent("location", `Map area selected: ${data.state || "Unknown"}, ${cityName}`);

      L.popup()
        .setLatLng([lat, lon])
        .setContent(
          `Location Info<br>State: ${data.state || "Unknown"}<br>City: ${cityName}<br>Village: ${data.village || "Unknown"}<br>District: ${data.district || "Unknown"}<br>Country: ${countryName}<br>Temp: ${weather.temperature ?? "--"}°C<br>Rainfall: ${weather.rainfall ?? "--"} mm<br>Humidity: ${weather.humidity ?? "--"}%<br>Wind: ${weather.wind_speed ?? "--"} m/s`
        )
        .openOn(map);

      refreshAreaData();
    } catch (err) {
      console.log("Map click error", err);
    }
  });
}

async function runPrediction() {
  const result = document.getElementById("predicted-level");
  if (result) result.innerText = "Processing...";

  try {
    const payload = {
      rainfall_mm_24h: latestWeather?.rainfall || 10,
      humidity: latestWeather?.humidity || 70,
      temperature_c: latestWeather?.temperature || 25,
      wind_speed: latestWeather?.wind_speed || 0,
      lat: activeLat,
      lon: activeLon,
    };

    const res = await fetch(`${BACKEND_URL}/api/predict-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (result) {
      const district = data?.drivers?.nearest_district ? ` | ${data.drivers.nearest_district}` : "";
      result.innerText = `${data.risk_label} (${data.confidence}%)${district}`;
      addHistoryEvent("prediction", `${data.risk_label} (${data.confidence}%) for selected area`);
      renderHistory();
    }
  } catch {
    if (result) result.innerText = "Prediction failed";
  }
}
window.runPrediction = runPrediction;

async function loadAlerts() {
  const box = document.getElementById("alerts-container");
  if (!box) return;
  box.innerHTML = "Loading live alerts...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/alerts?lat=${activeLat}&lon=${activeLon}`);
    const data = await res.json();
    if (!Array.isArray(data.alerts) || !data.alerts.length) {
      box.innerHTML = "No alerts available.";
      return;
    }

    box.innerHTML = data.alerts
      .map((a) => {
        const sev = (a.severity || "low").toUpperCase();
        return `<p><strong>[${sev}] ${a.title}</strong><br>${a.message}</p>`;
      })
      .join("");
  } catch (e) {
    box.innerHTML = "Unable to load alerts.";
    console.log("Alerts error", e);
  }
}

async function loadForecast() {
  const box = document.getElementById("forecast-results");
  if (box) box.innerHTML = "Loading forecast...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/flood-forecast?lat=${activeLat}&lon=${activeLon}`);
    const data = await res.json();

    if (!box) return;
    if (!Array.isArray(data.forecast)) {
      box.innerHTML = "Forecast unavailable.";
      return;
    }

    box.innerHTML = data.forecast
      .map((f) => `<p>${f.timestamp}: ${f.rainfall_mm} mm, Humidity ${f.humidity ?? "--"}% - ${f.risk}</p>`)
      .join("");
  } catch (e) {
    if (box) box.innerHTML = "Forecast request failed.";
    console.log("Forecast error", e);
  }
}
window.loadForecast = loadForecast;

async function loadHotspotAnalytics() {
  const box = document.getElementById("hotspot-stats");
  const satBox = document.getElementById("hotspot-satellite-gallery");
  if (!box) return;
  box.innerHTML = "Loading hotspot analytics...";
  if (satBox) satBox.innerHTML = "Loading satellite snapshots...";

  try {
    const [res1, res2, res3] = await Promise.all([
      fetch(`${BACKEND_URL}/api/hotspot-analysis`),
      fetch(`${BACKEND_URL}/api/hydrology-engine-summary`),
      fetch(`${BACKEND_URL}/api/hotspot-satellite?limit=6`),
    ]);
    const data = await res1.json();
    const summary = await res2.json();
    const sat = await res3.json();

    box.innerHTML = [
      `<p>Total India hotspots: <strong>${data.total_hotspots ?? 0}</strong></p>`,
      `<p>Engine micro-hotspots identified: <strong>${summary.micro_hotspots_identified ?? data.total_hotspots ?? 0}</strong></p>`,
      `<p>High risk zones: <strong>${data.high_risk_zones ?? 0}</strong></p>`,
      `<p>Moderate risk zones: <strong>${data.moderate_risk_zones ?? 0}</strong></p>`,
      `<p>Low risk zones: <strong>${data.low_risk_zones ?? 0}</strong></p>`,
      `<p>Hydrology engine: <strong>${summary.method || "N/A"}</strong></p>`,
    ].join("");

    if (satBox) {
      if (!Array.isArray(sat.images) || !sat.images.length) {
        satBox.innerHTML = "No satellite snapshots available.";
      } else {
        satBox.innerHTML = sat.images
          .map(
            (img) =>
              `<div style="margin-bottom:12px;">
                <p><strong>${img.ward_id || "Hotspot"}</strong> | ${img.district || "Unknown"} | Risk ${img.risk_score}</p>
                <img src="${img.satellite_image_url}" alt="Satellite hotspot" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #c8d4e3;">
                <p style="margin-top:6px;"><a href="${img.viewer_url}" target="_blank" rel="noopener noreferrer">Open Interactive Satellite View</a></p>
              </div>`
          )
          .join("");
      }
    }
  } catch (e) {
    box.innerHTML = "Unable to load hotspot analytics.";
    if (satBox) satBox.innerHTML = "Unable to load satellite snapshots.";
    console.log("Hotspot analytics error", e);
  }
}

async function loadReadiness() {
  const box = document.getElementById("readiness-list");
  if (!box) return;
  box.innerHTML = "Loading readiness score...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/readiness-score`);
    const data = await res.json();

    const top = Array.isArray(data.top_prepared) ? data.top_prepared.slice(0, 5) : [];
    const weak = Array.isArray(data.needs_attention) ? data.needs_attention.slice(0, 5) : [];
    const deployment = Array.isArray(data.deployment_plan) ? data.deployment_plan.slice(0, 3) : [];

    box.innerHTML = [
      `<p>Average readiness score: <strong>${data.avg_readiness ?? "--"}</strong></p>`,
      `<p>Total wards in model: <strong>${data.total_wards ?? 0}</strong></p>`,
      `<p>Total districts in model: <strong>${data.total_districts ?? 0}</strong></p>`,
      `<p>High risk wards: <strong>${data.high_risk_wards ?? 0}</strong> | Moderate: <strong>${data.moderate_risk_wards ?? 0}</strong></p>`,
      `<p><strong>Top Prepared Wards:</strong> ${top.map((x) => `${x.ward_id || x.district} (${x.readiness_score})`).join(", ")}</p>`,
      `<p><strong>Needs Attention Wards:</strong> ${weak.map((x) => `${x.ward_id || x.district} (${x.readiness_score})`).join(", ")}</p>`,
      `<p><strong>Priority Deployment:</strong> ${deployment
        .map(
          (d) =>
            `${d.ward_id} -> Pumps ${d.recommended_resources?.dewatering_pumps ?? 0}, Boats ${d.recommended_resources?.rescue_boats ?? 0}`
        )
        .join(" | ")}</p>`,
    ].join("");
  } catch (e) {
    box.innerHTML = "Unable to load readiness score.";
    console.log("Readiness error", e);
  }
}

async function loadActionPlan() {
  const box = document.getElementById("action-plan");
  if (!box) return;
  box.innerHTML = "Generating action plan...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/action-plan?lat=${activeLat}&lon=${activeLon}`);
    const data = await res.json();
    if (data.status !== "success") {
      box.innerHTML = "Action plan unavailable.";
      return;
    }

    const metrics = data.key_metrics || {};
    const citizen = Array.isArray(data.citizen_actions) ? data.citizen_actions : [];
    const authority = Array.isArray(data.authority_actions) ? data.authority_actions : [];
    const safe = Array.isArray(data.nearest_safe_places) ? data.nearest_safe_places.slice(0, 3) : [];
    const sev = (data.severity || "low").toUpperCase();

    box.innerHTML = [
      `<p><strong>Severity:</strong> ${sev}</p>`,
      `<p><strong>Area:</strong> ${data.location?.district || "Unknown"} (${data.location?.ward_id || "N/A"})</p>`,
      `<p><strong>Risk:</strong> ${metrics.predicted_risk_label || "N/A"} (${metrics.confidence || "--"}%)</p>`,
      `<p><strong>Ward Readiness:</strong> ${metrics.ward_readiness_score ?? "--"} | <strong>Drainage:</strong> ${metrics.drainage_capacity ?? "--"}</p>`,
      `<p><strong>For Citizens:</strong> ${citizen.join(" ")}</p>`,
      `<p><strong>For Authorities:</strong> ${authority.join(" ")}</p>`,
      `<p><strong>Nearest Safe Places:</strong> ${safe.map((s) => `${s.name} (${s.distance_km} km)`).join(", ") || "N/A"}</p>`,
    ].join("");
  } catch (e) {
    box.innerHTML = "Unable to generate action plan.";
    console.log("Action plan error", e);
  }
}
window.loadActionPlan = loadActionPlan;

async function fetchShelters() {
  const container = document.getElementById("shelter-list");
  if (container) container.innerHTML = "Loading nearby shelters...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/shelters?lat=${activeLat}&lon=${activeLon}&radius_km=20`);
    const data = await res.json();

    if (!container) return;
    if (!Array.isArray(data.shelters) || !data.shelters.length) {
      container.innerHTML = "No shelters found.";
      sheltersCache = [];
      return;
    }
    sheltersCache = data.shelters;

    container.innerHTML = data.shelters
      .slice(0, 10)
      .map((s) => `<p><strong>${s.name}</strong> (${s.type || "shelter"}) - ${s.distance_km ?? "--"} km${s.address ? `<br>${s.address}` : ""}</p>`)
      .join("");
  } catch (e) {
    sheltersCache = [];
    if (container) container.innerHTML = "Unable to load shelters.";
    console.log("Shelter error", e);
  }
}

function setupRouteControls() {
  const findBtn = document.getElementById("find-route");
  const clearBtn = document.getElementById("clear-route");
  if (findBtn) findBtn.addEventListener("click", () => calculateSafeRoute(null));
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (routeLayer && routeMap) routeMap.removeLayer(routeLayer);
      if (routeTargetMarker && routeMap) routeMap.removeLayer(routeTargetMarker);
      routeLayer = null;
      routeTargetMarker = null;
      if (routeUserMarker && routeMap) {
        routeUserMarker.setLatLng([activeLat, activeLon]);
        routeMap.setView([activeLat, activeLon], 7);
      }
      const box = document.getElementById("route-result");
      if (box) box.innerText = "Route cleared.";
    });
  }
}

async function loadRouteOptions() {
  const box = document.getElementById("route-options");
  if (!box) return;
  box.innerHTML = "Loading nearby safe places...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/shelters?lat=${activeLat}&lon=${activeLon}&radius_km=35`);
    const data = await res.json();
    const options = Array.isArray(data.shelters) ? data.shelters : [];
    const valid = options.filter((s) => Number.isFinite(parseFloat(s.latitude)) && Number.isFinite(parseFloat(s.longitude)));
    routeOptionsCache = valid.slice(0, 8);

    if (!routeOptionsCache.length) {
      box.innerHTML = "No safe places available right now.";
      return;
    }

    box.innerHTML = routeOptionsCache
      .map(
        (s, idx) =>
          `<p><strong>${idx + 1}. ${s.name || "Safe Place"}</strong> (${s.type || "shelter"}) - ${s.distance_km ?? "--"} km<br>${s.address || ""}<br><button onclick="selectRouteOption(${idx})">Route Here</button></p>`
      )
      .join("");
  } catch (e) {
    box.innerHTML = "Unable to load safe places.";
    console.log("Route options error", e);
  }
}

function selectRouteOption(index) {
  const target = routeOptionsCache[index];
  if (!target) return;
  calculateSafeRoute(target);
}
window.selectRouteOption = selectRouteOption;

async function calculateSafeRoute(targetOverride) {
  const box = document.getElementById("route-result");
  if (box) box.innerText = "Finding safest route...";
  ensureRouteMap();

  try {
    let url = `${BACKEND_URL}/api/safe-route?lat=${activeLat}&lon=${activeLon}`;
    if (targetOverride) {
      url += `&target_lat=${encodeURIComponent(targetOverride.latitude)}&target_lon=${encodeURIComponent(
        targetOverride.longitude
      )}&target_name=${encodeURIComponent(targetOverride.name || "Selected Safe Place")}`;
    }
    const res = await fetch(url);
    const routeData = await res.json();
    if (!routeData || routeData.status !== "success" || !Array.isArray(routeData.coordinates) || routeData.coordinates.length < 2) {
      if (box) box.innerText = "Route service unavailable right now.";
      return;
    }

    const target = routeData.target || {};
    const latLngs = routeData.coordinates.map((p) => [parseFloat(p[0]), parseFloat(p[1])]);
    if (!routeMap) {
      if (box) box.innerText = "Route map not ready.";
      return;
    }
    if (routeLayer) routeMap.removeLayer(routeLayer);
    if (routeTargetMarker) routeMap.removeLayer(routeTargetMarker);
    if (routeUserMarker) routeUserMarker.setLatLng([activeLat, activeLon]);

    routeLayer = L.polyline(latLngs, { color: "#0059b3", weight: 5, opacity: 0.85 }).addTo(routeMap);
    routeTargetMarker = L.marker([parseFloat(target.latitude), parseFloat(target.longitude)])
      .addTo(routeMap)
      .bindPopup(`Safe point: ${target.name || "Shelter"}`)
      .openPopup();
    routeMap.fitBounds(routeLayer.getBounds(), { padding: [25, 25] });

    const modeNote = routeData.mode === "fallback" ? " (fallback route)" : "";
    if (box) {
      box.innerHTML = `Route ready${modeNote}: <strong>${routeData.distance_km} km</strong>, ~<strong>${routeData.duration_min} min</strong> to <strong>${target.name || "Shelter"}</strong>.`;
      addHistoryEvent("route", `Route generated to ${target.name || "Shelter"} (${routeData.distance_km} km)`);
      renderHistory();
    }
  } catch (e) {
    if (box) box.innerText = "Unable to compute route now.";
    console.log("Route error", e);
  }
}

function submitReport() {
  const input = document.getElementById("report-text");
  if (!input) return;

  const text = (input.value || "").trim();
  if (!text) {
    alert("Please add report details first.");
    return;
  }

  addHistoryEvent("report", text);
  renderHistory();
  input.value = "";
}
window.submitReport = submitReport;

function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSOSMessage(area, weather, safePlaces) {
  const state = area?.state || "Unknown";
  const district = area?.district || "Unknown";
  const city = area?.city && area.city !== "Unknown" ? area.city : area?.village || "Unknown";
  const rain = weather?.rainfall ?? latestWeather?.rainfall ?? "--";
  const temp = weather?.temperature ?? latestWeather?.temperature ?? "--";
  const humidity = weather?.humidity ?? latestWeather?.humidity ?? "--";
  const wind = weather?.wind_speed ?? latestWeather?.wind_speed ?? "--";
  const risk = document.getElementById("risk-text")?.innerText || "Unknown";
  const nearest = (safePlaces || [])
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${s.name || "Safe Place"} (${s.distance_km ?? "--"} km)`)
    .join("\n");

  return [
    "SOS EMERGENCY - FLOOD ASSISTANCE NEEDED",
    `Time: ${new Date().toLocaleString()}`,
    `Location: ${city}, ${district}, ${state}, India`,
    `Coordinates: ${Number(activeLat).toFixed(5)}, ${Number(activeLon).toFixed(5)}`,
    `Weather: Temp ${temp} C, Rain ${rain} mm, Humidity ${humidity}%, Wind ${wind} m/s`,
    `Current Flood Risk: ${risk}`,
    nearest ? `Nearest Safe Places:\n${nearest}` : "Nearest Safe Places: Not available right now",
    "Need immediate response support.",
  ].join("\n");
}

function renderSOSContacts(area) {
  const box = document.getElementById("sos-contacts");
  if (!box) return;
  const state = area?.state || "";
  const stateNumber = SOS_STATE_CONTROL_ROOMS[state];
  const stateRow = stateNumber
    ? `<p><strong>${escapeHtml(state)} State Control Room</strong><br><a href="tel:${stateNumber}">${stateNumber}</a></p>`
    : "";

  box.innerHTML =
    `<h3>Emergency Contacts</h3>` +
    stateRow +
    SOS_CONTACTS_NATIONAL.map(
      (c) =>
        `<p><strong>${escapeHtml(c.name)}</strong><br><a href="tel:${escapeHtml(c.number)}">${escapeHtml(c.number)}</a> - ${escapeHtml(
          c.note
        )}</p>`
    ).join("");
}

function renderSOSNearby(safePlaces) {
  const box = document.getElementById("sos-nearby");
  if (!box) return;
  if (!Array.isArray(safePlaces) || !safePlaces.length) {
    box.innerHTML = "<h3>Nearby Safe Places</h3><p>No verified safe places found nearby.</p>";
    return;
  }
  box.innerHTML =
    `<h3>Nearby Safe Places</h3>` +
    safePlaces
      .slice(0, 6)
      .map(
        (s) =>
          `<p><strong>${escapeHtml(s.name || "Safe Place")}</strong> (${escapeHtml(s.type || "shelter")}) - ${escapeHtml(
            s.distance_km ?? "--"
          )} km${s.address ? `<br>${escapeHtml(s.address)}` : ""}</p>`
      )
      .join("");
}

async function loadSOSPanel() {
  const contextBox = document.getElementById("sos-context");
  const msgBox = document.getElementById("sos-message");
  if (!contextBox || !msgBox) return;

  contextBox.innerHTML = "Loading SOS context...";
  msgBox.value = "Preparing SOS message...";

  try {
    const [locRes, shelterRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/location-intel?lat=${activeLat}&lon=${activeLon}`),
      fetch(`${BACKEND_URL}/api/shelters?lat=${activeLat}&lon=${activeLon}&radius_km=35`),
    ]);

    const locData = await locRes.json();
    const shelterData = await shelterRes.json();
    const area = {
      state: locData?.state || latestLocationIntel?.state || "Unknown",
      district: locData?.district || latestLocationIntel?.district || "Unknown",
      city: locData?.city || latestLocationIntel?.city || "Unknown",
      village: locData?.village || latestLocationIntel?.village || "Unknown",
      country: locData?.country || latestLocationIntel?.country || "IN",
      weather: locData?.weather || latestWeather || {},
    };
    latestLocationIntel = { ...(latestLocationIntel || {}), ...area, weather: area.weather };

    const safePlaces = Array.isArray(shelterData?.shelters) ? shelterData.shelters : sheltersCache || [];
    const city = area.city && area.city !== "Unknown" ? area.city : area.village || "Unknown";
    const countryLabel = area.country === "IN" ? "India" : area.country;

    contextBox.innerHTML = [
      `<h3>Location Context</h3>`,
      `<p><strong>State:</strong> ${escapeHtml(area.state)} | <strong>District:</strong> ${escapeHtml(area.district)}</p>`,
      `<p><strong>City/Village:</strong> ${escapeHtml(city)} | <strong>Country:</strong> ${escapeHtml(countryLabel)}</p>`,
      `<p><strong>Coordinates:</strong> ${Number(activeLat).toFixed(5)}, ${Number(activeLon).toFixed(5)}</p>`,
      `<p><strong>Weather:</strong> Temp ${escapeHtml(area.weather?.temperature ?? "--")} C, Rain ${escapeHtml(
        area.weather?.rainfall ?? "--"
      )} mm, Humidity ${escapeHtml(area.weather?.humidity ?? "--")}% , Wind ${escapeHtml(area.weather?.wind_speed ?? "--")} m/s</p>`,
      `<p><strong>Risk:</strong> ${escapeHtml(document.getElementById("risk-text")?.innerText || "Unknown")}</p>`,
    ].join("");

    msgBox.value = buildSOSMessage(area, area.weather, safePlaces);
    renderSOSContacts(area);
    renderSOSNearby(safePlaces);
  } catch (e) {
    contextBox.innerHTML = "Unable to load SOS area context.";
    msgBox.value = `SOS EMERGENCY\nLocation: ${activeLat.toFixed(5)}, ${activeLon.toFixed(5)}\nNeed immediate response support.`;
    renderSOSContacts(latestLocationIntel || {});
    renderSOSNearby([]);
    console.log("SOS panel error", e);
  }
}

async function copySOSMessage() {
  const msg = document.getElementById("sos-message")?.value?.trim();
  if (!msg) {
    alert("SOS message is not ready yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(msg);
    addHistoryEvent("sos", "SOS message copied.");
    renderHistory();
    alert("SOS message copied.");
  } catch {
    alert("Copy failed. Please copy manually.");
  }
}
window.copySOSMessage = copySOSMessage;

async function shareSOSMessage() {
  const msg = document.getElementById("sos-message")?.value?.trim();
  if (!msg) {
    alert("SOS message is not ready yet.");
    return;
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: "Flood Guard SOS", text: msg });
    } else {
      await navigator.clipboard.writeText(msg);
      alert("Share not supported here. Message copied instead.");
    }
    addHistoryEvent("sos", "SOS message shared.");
    renderHistory();
  } catch (e) {
    console.log("Share SOS error", e);
  }
}
window.shareSOSMessage = shareSOSMessage;

function openWhatsAppSOS() {
  const msg = document.getElementById("sos-message")?.value?.trim();
  if (!msg) {
    alert("SOS message is not ready yet.");
    return;
  }
  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  addHistoryEvent("sos", "SOS message opened in WhatsApp.");
  renderHistory();
}
window.openWhatsAppSOS = openWhatsAppSOS;

async function triggerSOS() {
  await loadSOSPanel();
  addHistoryEvent("sos", "SOS triggered from current selected location.");
  renderHistory();
  alert("SOS ready. Share it now using Copy, Share, or WhatsApp.");
}
window.triggerSOS = triggerSOS;

async function loadNews() {
  const box = document.getElementById("news-list");
  if (box) box.innerHTML = "Loading news...";

  try {
    const langSel = document.getElementById("news-lang");
    const lang = langSel?.value || "en";
    const res = await fetch(`${BACKEND_URL}/api/news?lang=${encodeURIComponent(lang)}`);
    const data = await res.json();

    if (!box) return;
    if (!Array.isArray(data.results)) {
      box.innerHTML = "No news available.";
      return;
    }

    box.innerHTML = data.results
      .map((n) => {
        const link = n.link ? `<br><a href="${n.link}" target="_blank" rel="noopener noreferrer">Read more</a>` : "";
        return `<p><strong>${n.title}</strong><br>${n.description || ""}${link}</p>`;
      })
      .join("");
  } catch (e) {
    if (box) box.innerHTML = "Unable to load news.";
    console.log("News error", e);
  }
}
window.loadNews = loadNews;

const RADAR_SOURCES = {
  "windy-rain": "https://embed.windy.com/embed2.html?lat=22.593&lon=78.962&zoom=5&level=surface&overlay=rain&menu=&message=&marker=&calendar=24&pressure=&type=map&location=coordinates&detail=&detailLat=22.593&detailLon=78.962&metricWind=default&metricTemp=default&radarRange=-1",
  "windy-thunder": "https://embed.windy.com/embed2.html?lat=22.593&lon=78.962&zoom=5&level=surface&overlay=thunder&menu=&message=&marker=&calendar=24&pressure=&type=map&location=coordinates&detail=&detailLat=22.593&detailLon=78.962&metricWind=default&metricTemp=default&radarRange=-1",
  "windy-wind": "https://embed.windy.com/embed2.html?lat=22.593&lon=78.962&zoom=5&level=surface&overlay=wind&menu=&message=&marker=&calendar=24&pressure=&type=map&location=coordinates&detail=&detailLat=22.593&detailLon=78.962&metricWind=default&metricTemp=default&radarRange=-1",
  "windy-temp": "https://embed.windy.com/embed2.html?lat=22.593&lon=78.962&zoom=5&level=surface&overlay=temp&menu=&message=&marker=&calendar=24&pressure=&type=map&location=coordinates&detail=&detailLat=22.593&detailLon=78.962&metricWind=default&metricTemp=default&radarRange=-1",
};

function setupRadarControls() {
  const select = document.getElementById("radar-source");
  const refresh = document.getElementById("refresh-radar");
  if (select) select.addEventListener("change", loadRadarSource);
  if (refresh) refresh.addEventListener("click", loadRadarSource);
}

function loadRadarSource() {
  const select = document.getElementById("radar-source");
  const frame = document.getElementById("radar-frame");
  const status = document.getElementById("radar-status");
  if (!select || !frame) return;

  const key = select.value || "windy-rain";
  const baseUrl = RADAR_SOURCES[key] || RADAR_SOURCES["windy-rain"];
  frame.src = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}ts=${Date.now()}`;

  if (status) {
    const updated = new Date().toLocaleTimeString();
    status.innerText = `Radar updated at ${updated}`;
  }
}

async function loadRadarInsights() {
  const box = document.getElementById("radar-insights");
  if (!box) return;
  box.innerHTML = "Loading nowcast insights...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/flood-forecast?lat=${activeLat}&lon=${activeLon}`);
    const data = await res.json();
    const rows = Array.isArray(data.forecast) ? data.forecast.slice(0, 8) : [];

    if (!rows.length) {
      box.innerHTML = "Nowcast unavailable.";
      return;
    }

    let peak = rows[0];
    rows.forEach((r) => {
      if ((r.rainfall_mm || 0) > (peak.rainfall_mm || 0)) peak = r;
    });
    const highSlots = rows.filter((r) => (r.risk || "").toLowerCase().includes("high")).length;
    const moderateSlots = rows.filter((r) => (r.risk || "").toLowerCase().includes("moderate")).length;
    const totalRain = rows.reduce((a, r) => a + (Number(r.rainfall_mm) || 0), 0).toFixed(1);

    box.innerHTML = [
      `<p><strong>Selected Area Nowcast (Next 24h)</strong></p>`,
      `<p>Peak rainfall window: <strong>${peak.timestamp || "N/A"}</strong> (${peak.rainfall_mm ?? 0} mm)</p>`,
      `<p>Expected cumulative rain: <strong>${totalRain} mm</strong></p>`,
      `<p>Risk windows: <strong>${highSlots}</strong> high, <strong>${moderateSlots}</strong> moderate</p>`,
      `<p>Tip: Switch layer between Rain, Thunder, Wind, and Temperature to inspect storm movement.</p>`,
    ].join("");
  } catch (e) {
    box.innerHTML = "Unable to load nowcast insights.";
    console.log("Radar insights error", e);
  }
}

function initCommunity() {
  if (!localStorage.getItem(VOLUNTEER_KEY)) setStoredArray(VOLUNTEER_KEY, []);
  if (!localStorage.getItem(REQUEST_KEY)) setStoredArray(REQUEST_KEY, []);
  renderCommunity();
}

function renderCommunity() {
  const volBox = document.getElementById("volunteer-list");
  const reqBox = document.getElementById("request-list");
  const status = document.getElementById("community-status");
  if (!volBox || !reqBox) return;

  const vols = getStoredArray(VOLUNTEER_KEY);
  const reqs = getStoredArray(REQUEST_KEY);

  volBox.innerHTML = `<div class="contact-list"><h3>Active Volunteers (${vols.length})</h3>${
    vols.length
      ? vols
          .slice(0, 10)
          .map((v) => `<p><strong>${v.name}</strong> | ${v.skill} | ${v.area}<br>${v.phone}</p>`)
          .join("")
      : "<p>No volunteers yet.</p>"
  }</div>`;

  reqBox.innerHTML = `<div class="contact-list"><h3>Help Requests (${reqs.filter((r) => r.status !== "resolved").length})</h3>${
    reqs.length
      ? reqs
          .slice(0, 12)
          .map((r) => {
            const match = vols.find((v) => v.area.toLowerCase().includes((r.area || "").toLowerCase()) || (r.area || "").toLowerCase().includes(v.area.toLowerCase()));
            const badge = r.status === "resolved" ? "Resolved" : r.priority.toUpperCase();
            const actionBtn =
              r.status === "resolved"
                ? ""
                : `<button onclick="resolveRequest(${r.id})">Mark Resolved</button>`;
            return `<p><strong>[${badge}] ${r.text}</strong><br>Area: ${r.area || "Selected area"} | Time: ${new Date(r.time).toLocaleString()}<br>${
              match ? `Matched volunteer: ${match.name} (${match.phone})` : "No immediate match yet"
            }<br>${actionBtn}</p>`;
          })
          .join("")
      : "<p>No requests yet.</p>"
  }</div>`;

  if (status) {
    status.innerText = `${vols.length} volunteers ready | ${reqs.filter((r) => r.status !== "resolved").length} active requests`;
  }
}

function registerVolunteer() {
  const name = (document.getElementById("vol-name")?.value || "").trim();
  const phone = (document.getElementById("vol-phone")?.value || "").trim();
  const area = (document.getElementById("vol-area")?.value || "").trim();
  const skill = document.getElementById("vol-skill")?.value || "rescue";

  if (!name || !phone || !area) {
    alert("Please fill volunteer name, phone, and area.");
    return;
  }

  const vols = getStoredArray(VOLUNTEER_KEY);
  vols.unshift({ id: Date.now(), name, phone, area, skill, time: new Date().toISOString() });
  setStoredArray(VOLUNTEER_KEY, vols.slice(0, 200));
  addHistoryEvent("community", `Volunteer registered: ${name} (${skill}) in ${area}`);
  renderCommunity();
}
window.registerVolunteer = registerVolunteer;

function submitHelpRequest() {
  const text = (document.getElementById("help-text")?.value || "").trim();
  const priority = document.getElementById("help-priority")?.value || "medium";
  if (!text) {
    alert("Please enter request details.");
    return;
  }

  const reqs = getStoredArray(REQUEST_KEY);
  const areaLabel = document.getElementById("user-location")?.innerText || "Selected area";
  reqs.unshift({
    id: Date.now(),
    text,
    priority,
    area: areaLabel,
    status: "open",
    time: new Date().toISOString(),
  });
  setStoredArray(REQUEST_KEY, reqs.slice(0, 300));
  addHistoryEvent("community", `Help request created (${priority}): ${text}`);
  renderCommunity();
}
window.submitHelpRequest = submitHelpRequest;

function resolveRequest(id) {
  const reqs = getStoredArray(REQUEST_KEY);
  const idx = reqs.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reqs[idx].status = "resolved";
  setStoredArray(REQUEST_KEY, reqs);
  addHistoryEvent("community", `Request resolved: ${reqs[idx].text}`);
  renderCommunity();
}
window.resolveRequest = resolveRequest;

function renderHistory() {
  const box = document.getElementById("history-data");
  if (!box) return;

  const filter = document.getElementById("history-filter")?.value || "all";
  const events = getStoredArray(HISTORY_KEY);
  const visible = filter === "all" ? events : events.filter((e) => e.type === filter);

  if (!visible.length) {
    box.innerHTML = "No activity yet.";
    return;
  }

  box.innerHTML = visible
    .slice(0, 120)
    .map((e) => {
      const ts = new Date(e.time).toLocaleString();
      return `<div class="contact-list"><strong>${e.type.toUpperCase()}</strong> | ${ts}<br>${e.message}<br>(${e.lat}, ${e.lon})</div>`;
    })
    .join("");
}
window.renderHistory = renderHistory;

function clearHistory() {
  if (!confirm("Clear all history events?")) return;
  setStoredArray(HISTORY_KEY, []);
  renderHistory();
}
window.clearHistory = clearHistory;

function exportHistory() {
  const events = getStoredArray(HISTORY_KEY);
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `floodguard-history-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportHistory = exportHistory;

function getAccountInputs() {
  return {
    name: (document.getElementById("acc-name")?.value || "").trim(),
    email: (document.getElementById("acc-email")?.value || "").trim(),
    password: document.getElementById("acc-password")?.value || "",
  };
}

function setAccountStatus(text) {
  const box = document.getElementById("account-status");
  if (box) box.innerText = text;
}

function renderAccount() {
  const card = document.getElementById("account-user");
  if (!card) return;
  if (accountState.user) {
    card.innerHTML = `Logged in as <strong>${accountState.user.name}</strong> (${accountState.user.email})`;
  } else {
    card.innerText = "Not logged in.";
  }
}

async function registerAccount() {
  const { name, email, password } = getAccountInputs();
  try {
    const res = await fetch(`${BACKEND_URL}/api/account/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setAccountStatus(data.error || data.message || "Done");
  } catch {
    setAccountStatus("Registration failed.");
  }
}
window.registerAccount = registerAccount;

async function loginAccount() {
  const { email, password } = getAccountInputs();
  try {
    const res = await fetch(`${BACKEND_URL}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      accountState.token = data.token;
      accountState.user = data.user;
      localStorage.setItem("fg_token", data.token);
      renderAccount();
    }
    setAccountStatus(data.error || data.message || "Done");
  } catch {
    setAccountStatus("Login failed.");
  }
}
window.loginAccount = loginAccount;

async function fetchProfile() {
  if (!accountState.token) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/account/profile?token=${accountState.token}`);
    const data = await res.json();
    if (data.user) {
      accountState.user = data.user;
      renderAccount();
    } else {
      accountState.token = "";
      localStorage.removeItem("fg_token");
    }
  } catch {
    accountState.token = "";
    localStorage.removeItem("fg_token");
  }
}

async function logoutAccount() {
  try {
    if (accountState.token) {
      await fetch(`${BACKEND_URL}/api/account/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accountState.token }),
      });
    }
  } finally {
    accountState.token = "";
    accountState.user = null;
    localStorage.removeItem("fg_token");
    renderAccount();
    setAccountStatus("Logged out.");
  }
}
window.logoutAccount = logoutAccount;
