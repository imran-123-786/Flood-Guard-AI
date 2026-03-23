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
let mapBaseLayer = null;
let radarRiverMap = null;
let radarRiverLayer = null;
let radarRiverAnimTimer = null;
let radarRiverRefreshTimer = null;
let appStarted = false;
let latestWeather = null;
let riverLayer = null;
let riverFlowLayer = null;
let userMarker = null;
let routeLayer = null;
let routeTargetMarker = null;
let routeUserMarker = null;
let tripRouteLayers = [];
let tripEndpointMarkers = [];
let sheltersCache = [];
let routeOptionsCache = [];
let latestLocationIntel = null;
let riversCache = [];
let selectedRiverId = "";
let locationUnlocked = false;
const SAVED_PLACES_KEY = "fg_saved_places_v1";
let savedPlaces = [];
const API_CACHE_PREFIX = "fg_api_cache_v1:";
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

const I18N = {
  en: { dashboard: "Dashboard", forecast: "Forecast", alerts: "Alerts", prediction: "Prediction", rivers: "Rivers", safety: "Safety Hub", radar: "Radar", rescue: "Rescue", news: "News", account: "Account", liveDashboard: "📍 Live Dashboard", riversTitle: "🏞 India River Monitor" },
  hi: { dashboard: "डैशबोर्ड", forecast: "पूर्वानुमान", alerts: "अलर्ट", prediction: "पूर्वानुमान एआई", rivers: "नदियाँ", safety: "सुरक्षा हब", radar: "रडार", rescue: "राहत", news: "समाचार", account: "खाता", liveDashboard: "📍 लाइव डैशबोर्ड", riversTitle: "🏞 भारत नदी मॉनिटर" },
  te: { dashboard: "డ్యాష్‌బోర్డ్", forecast: "ఫోర్‌కాస్ట్", alerts: "అలర్ట్స్", prediction: "ప్రిడిక్షన్", rivers: "నదులు", safety: "సేఫ్టీ హబ్", radar: "రాడార్", rescue: "రక్షణ", news: "వార్తలు", account: "ఖాతా", liveDashboard: "📍 లైవ్ డాష్‌బోర్డ్", riversTitle: "🏞 భారత నది మానిటర్" },
  ta: { dashboard: "டாஷ்போர்டு", forecast: "முன்னறிவிப்பு", alerts: "எச்சரிக்கை", prediction: "கணிப்பு", rivers: "நதிகள்", safety: "பாதுகாப்பு ஹப்", radar: "ரேடார்", rescue: "மீட்பு", news: "செய்தி", account: "கணக்கு", liveDashboard: "📍 நேரடி டாஷ்போர்டு", riversTitle: "🏞 இந்திய நதி கண்காணிப்பு" },
  kn: { dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", forecast: "ಭವಿಷ್ಯ", alerts: "ಅಲರ್ಟ್", prediction: "ಭವಿಷ್ಯವಾಣಿ", rivers: "ನದಿಗಳು", safety: "ಸೇಫ್ಟಿ ಹಬ್", radar: "ರಡಾರ್", rescue: "ರಕ್ಷಣೆ", news: "ಸುದ್ದಿ", account: "ಖಾತೆ", liveDashboard: "📍 ಲೈವ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", riversTitle: "🏞 ಭಾರತ ನದಿ ಮಾನಿಟರ್" },
  mr: { dashboard: "डॅशबोर्ड", forecast: "अंदाज", alerts: "अलर्ट", prediction: "भविष्यवाणी", rivers: "नद्या", safety: "सेफ्टी हब", radar: "रडार", rescue: "बचाव", news: "बातम्या", account: "खाते", liveDashboard: "📍 लाईव्ह डॅशबोर्ड", riversTitle: "🏞 भारत नदी मॉनिटर" },
  bn: { dashboard: "ড্যাশবোর্ড", forecast: "পূর্বাভাস", alerts: "সতর্কতা", prediction: "প্রেডিকশন", rivers: "নদী", safety: "সেফটি হাব", radar: "রাডার", rescue: "উদ্ধার", news: "সংবাদ", account: "অ্যাকাউন্ট", liveDashboard: "📍 লাইভ ড্যাশবোর্ড", riversTitle: "🏞 ভারত নদী মনিটর" },
  gu: { dashboard: "ડેશબોર્ડ", forecast: "અનુમાન", alerts: "ચેતવણી", prediction: "પ્રેડિક્શન", rivers: "નદીઓ", safety: "સેફ્ટી હબ", radar: "રડાર", rescue: "રેસ્ક્યુ", news: "સમાચાર", account: "એકાઉન્ટ", liveDashboard: "📍 લાઈવ ડેશબોર્ડ", riversTitle: "🏞 ભારત નદી મોનિટર" },
};

const MAP_STYLE_URLS = {
  street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  terrain: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

function insideIndia(lat, lon) {
  return lat >= INDIA_BOUNDS.latMin && lat <= INDIA_BOUNDS.latMax && lon >= INDIA_BOUNDS.lonMin && lon <= INDIA_BOUNDS.lonMax;
}

function showSection(id) {
  if (!locationUnlocked && id !== "dashboard") {
    updateLocationText("Allow location to unlock all tabs.");
    const gate = document.getElementById("location-gate");
    if (gate) gate.style.display = "flex";
    id = "dashboard";
  }

  document.querySelectorAll(".section").forEach((sec) => sec.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  document.querySelectorAll(".nav-menu button").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = Array.from(document.querySelectorAll(".nav-menu button")).find((btn) => btn.getAttribute("onclick") === `showSection('${id}')`);
  if (activeBtn) activeBtn.classList.add("active");
  document.querySelectorAll(".mobile-quick-nav button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === id);
  });

  if (id === "dashboard" && map) {
    setTimeout(() => map.invalidateSize(), 80);
  }
  if (id === "forecast") loadForecast();
  if (id === "alerts") loadAlerts();
  if (id === "rivers") renderRiversTab();
  if (id === "safety") {
    fetchShelters();
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
  if (id === "news") loadNews();
  if (id === "account") renderAccount();
}
window.showSection = showSection;

window.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  syncMobileLayoutMode();
  setupNetworkStatus();
  document.querySelectorAll(".mobile-quick-nav button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === "dashboard");
  });
  initSavedPlaces();
  initOnboarding();
  setupRouteControls();
  setupTripPlanner();
  setupMapControls();
  setupLocationGate();
  setupRadarControls();
  setupLanguageSwitch();
  setupPredictionSimulator();
  applyLanguage(localStorage.getItem("fg_lang") || "en");
  loadRadarSource();
  if (accountState.token) fetchProfile();
  startLiveDashboardClock();
  setInterval(() => {
    if (document.getElementById("alerts")?.classList.contains("active")) loadAlerts();
  }, 60000);
});

function setupNetworkStatus() {
  const bar = document.getElementById("network-status");
  if (!bar) return;
  const draw = () => {
    bar.style.display = navigator.onLine ? "none" : "block";
  };
  draw();
  window.addEventListener("online", draw);
  window.addEventListener("offline", draw);
}

function readApiCache(cacheKey, maxAgeSec = 1800) {
  try {
    const raw = localStorage.getItem(API_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts) return null;
    const age = (Date.now() - parsed.ts) / 1000;
    if (age > maxAgeSec) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeApiCache(cacheKey, data) {
  try {
    localStorage.setItem(API_CACHE_PREFIX + cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore cache write errors
  }
}

async function fetchJsonCached(url, cacheKey, maxAgeSec = 1800) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) writeApiCache(cacheKey, data);
    return data;
  } catch {
    const cached = readApiCache(cacheKey, maxAgeSec);
    if (cached) return cached;
    throw new Error("offline_no_cache");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isHttpLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const isSecure = location.protocol === "https:";
  if (!isSecure && !isHttpLocal) return;

  navigator.serviceWorker
    .register("./sw.js")
    .catch((err) => console.log("Service worker registration failed", err));
}

function startLiveDashboardClock() {
  const el = document.getElementById("live-time-card");
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.innerText = `${now.toLocaleTimeString()} Time`;
  };
  tick();
  setInterval(tick, 1000);
}

window.addEventListener("resize", () => {
  syncMobileLayoutMode();
  if (selectedRiverId) renderRiverDetails(selectedRiverId);
});

function syncMobileLayoutMode() {
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  document.body.classList.toggle("mobile-nav-enabled", mobile);
}

function initOnboarding() {
  const key = "fg_onboarding_seen_v1";
  const card = document.getElementById("onboarding-card");
  if (!card) return;
  if (localStorage.getItem(key) === "1") {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";
}

function dismissOnboarding() {
  localStorage.setItem("fg_onboarding_seen_v1", "1");
  const card = document.getElementById("onboarding-card");
  if (card) card.style.display = "none";
}
window.dismissOnboarding = dismissOnboarding;

function updateLastSyncStamp(label = "Live synced") {
  const el = document.getElementById("dashboard-last-sync");
  if (!el) return;
  el.innerText = `${label} • ${new Date().toLocaleTimeString()}`;
}

function requestLocation() {
  initLocation(true);
}
window.requestLocation = requestLocation;

function hideLocationGate() {
  const gate = document.getElementById("location-gate");
  if (gate) gate.style.display = "none";
}

function setNavLocked(locked) {
  document.querySelectorAll(".nav-menu button").forEach((btn) => {
    const isDashboard = btn.getAttribute("onclick") === "showSection('dashboard')";
    btn.disabled = locked && !isDashboard;
    btn.classList.toggle("locked-tab", locked && !isDashboard);
  });
}

function setupLocationGate() {
  const gate = document.getElementById("location-gate");
  const allowVisit = document.getElementById("loc-allow-visit");
  const allowOnce = document.getElementById("loc-allow-once");
  const never = document.getElementById("loc-never");
  if (!gate) return;

  const saved = localStorage.getItem("fg_loc_pref") || "";
  if (saved === "never") {
    gate.style.display = "flex";
    updateLocationText("Location permission required to continue.");
    setNavLocked(true);
    return;
  }
  if (saved === "allow_visit") {
    setNavLocked(true);
    gate.style.display = "none";
    initLocation(true);
    return;
  }

  gate.style.display = "flex";
  setNavLocked(true);
  if (allowVisit) {
    allowVisit.addEventListener("click", () => {
      localStorage.setItem("fg_loc_pref", "allow_visit");
      hideLocationGate();
      initLocation(true);
    });
  }
  if (allowOnce) {
    allowOnce.addEventListener("click", () => {
      hideLocationGate();
      initLocation(true);
    });
  }
  if (never) {
    never.addEventListener("click", () => {
      localStorage.setItem("fg_loc_pref", "never");
      gate.style.display = "flex";
      updateLocationText("Location permission required to continue.");
      setNavLocked(true);
    });
  }
}

function initLocation(userRequested = false) {
  if (!navigator.geolocation) {
    updateLocationText("GPS not supported on this device.");
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
      updateLiveLocationDetails(userLat, userLon);
      locationUnlocked = true;
      setNavLocked(false);
      hideLocationGate();
      startOrRefreshApp();
    },
    () => {
      locationUnlocked = false;
      setNavLocked(true);
      updateLocationText("Location permission denied. Please allow to continue.");
      const gate = document.getElementById("location-gate");
      if (gate) gate.style.display = "flex";
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
  if (userMarker && map) userMarker.setLatLng([activeLat, activeLon]).bindPopup("Selected Area");
}


function refreshAreaData() {
  fetchWeather();
  fetchShelters();
  loadRiverMarkers();
  loadAlerts();
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
    setIndiaOverviewMap();
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
  }).setView([20.5937, 78.9629], 5);

  setMapStyle("street");

  userMarker = L.marker([userLat, userLon]).addTo(map).bindPopup("Your Location");
  riverLayer = L.layerGroup().addTo(map);
  riverFlowLayer = L.layerGroup().addTo(map);
  setIndiaOverviewMap();
  setTimeout(() => map.invalidateSize(), 400);
}

function setIndiaOverviewMap() {
  if (!map) return;
  map.fitBounds(
    [
      [6.0, 68.0],
      [38.5, 97.5],
    ],
    { padding: [18, 18] }
  );
}

function setupLanguageSwitch() {
  const sel = document.getElementById("app-lang");
  if (!sel) return;
  sel.value = localStorage.getItem("fg_lang") || "en";
  sel.addEventListener("change", () => {
    applyLanguage(sel.value);
  });
}

function applyLanguage(lang) {
  const l = I18N[lang] ? lang : "en";
  localStorage.setItem("fg_lang", l);
  const t = I18N[l];
  const btn = (id, text) => {
    const b = document.querySelector(`button[onclick="showSection('${id}')"]`);
    if (b) b.innerText = text;
  };
  btn("dashboard", t.dashboard);
  btn("forecast", t.forecast);
  btn("alerts", t.alerts);
  btn("prediction", t.prediction);
  btn("rivers", t.rivers);
  btn("safety", t.safety);
  btn("radar", t.radar);
  btn("rescue", t.rescue);
  btn("news", t.news);
  btn("account", t.account);
  const h2Dash = document.querySelector("#dashboard h2");
  const h2Rivers = document.querySelector("#rivers h2");
  if (h2Dash) h2Dash.innerText = t.liveDashboard;
  if (h2Rivers) h2Rivers.innerText = t.riversTitle;
}

function setMapStyle(styleKey) {
  if (!map) return;
  const key = MAP_STYLE_URLS[styleKey] ? styleKey : "street";
  if (mapBaseLayer) map.removeLayer(mapBaseLayer);

  const tileUrl = MAP_STYLE_URLS[key];
  const attrib =
    key === "satellite"
      ? "Tiles &copy; Esri"
      : key === "terrain"
      ? "Map data: &copy; OpenStreetMap contributors, SRTM"
      : "&copy; OpenStreetMap contributors";

  mapBaseLayer = L.tileLayer(tileUrl, {
    maxZoom: key === "satellite" ? 19 : 18,
    attribution: attrib,
  }).addTo(map);
}

function setupMapControls() {
  const styleSelect = document.getElementById("map-style-select");
  if (styleSelect) {
    styleSelect.addEventListener("change", () => {
      setMapStyle(styleSelect.value);
    });
  }
}

function nearestHighRiskRiver(lat, lon) {
  if (!Array.isArray(riversCache) || !riversCache.length) return null;
  const high = riversCache.filter((r) => String(r.risk_level || "").toLowerCase() === "high");
  const pool = high.length ? high : riversCache;
  let best = null;
  let bestD = Infinity;
  pool.forEach((r) => {
    const d = haversineKm(lat, lon, Number(r.lat), Number(r.lon));
    if (Number.isFinite(d) && d < bestD) {
      bestD = d;
      best = r;
    }
  });
  if (!best) return null;
  return { ...best, distance_km: Number(bestD.toFixed(1)) };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function updateLiveLocationDetails(lat, lon) {
  const box = document.getElementById("user-location-details");
  if (!box) return;
  box.innerHTML = "Loading location details...";

  try {
    if (!Array.isArray(riversCache) || !riversCache.length) {
      await loadRiverMarkers();
    }
    const info = await fetchJsonCached(
      `${BACKEND_URL}/api/location-intel?lat=${lat}&lon=${lon}`,
      `location_${lat.toFixed(3)}_${lon.toFixed(3)}`,
      86400
    );
    latestLocationIntel = info;
    const nearRiver = nearestHighRiskRiver(lat, lon);

    box.innerHTML = [
      `<p><strong>State:</strong> ${escapeHtml(info.state || "Unknown")} | <strong>City:</strong> ${escapeHtml(info.city || "Unknown")}</p>`,
      `<p><strong>Village:</strong> ${escapeHtml(info.village || "Unknown")} | <strong>District:</strong> ${escapeHtml(
        info.district || "Unknown"
      )}</p>`,
      `<p><strong>Latitude:</strong> ${Number(lat).toFixed(4)} | <strong>Longitude:</strong> ${Number(lon).toFixed(4)}</p>`,
      `<p><strong>Nearest High-Risk River:</strong> ${
        nearRiver ? `${escapeHtml(nearRiver.name)} (${escapeHtml(nearRiver.city || "Unknown")}) - ${nearRiver.distance_km} km` : "Not available"
      }</p>`,
    ].join("");
  } catch {
    box.innerHTML = `<p><strong>Latitude:</strong> ${Number(lat).toFixed(4)} | <strong>Longitude:</strong> ${Number(lon).toFixed(4)}</p>`;
  }
}

function updateLiveLocationDetailsFromIntel(info, lat, lon) {
  const box = document.getElementById("user-location-details");
  if (!box) return;
  latestLocationIntel = info || latestLocationIntel;
  const nearRiver = nearestHighRiskRiver(lat, lon);
  box.innerHTML = [
    `<p><strong>State:</strong> ${escapeHtml(info.state || "Unknown")} | <strong>City:</strong> ${escapeHtml(info.city || "Unknown")}</p>`,
    `<p><strong>Village:</strong> ${escapeHtml(info.village || "Unknown")} | <strong>District:</strong> ${escapeHtml(info.district || "Unknown")}</p>`,
    `<p><strong>Latitude:</strong> ${Number(lat).toFixed(4)} | <strong>Longitude:</strong> ${Number(lon).toFixed(4)}</p>`,
    `<p><strong>Nearest High-Risk River:</strong> ${
      nearRiver ? `${escapeHtml(nearRiver.name)} (${escapeHtml(nearRiver.city || "Unknown")}) - ${nearRiver.distance_km} km` : "Not available"
    }</p>`,
  ].join("");
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
    const data = await fetchJsonCached(
      `${BACKEND_URL}/api/weather?lat=${activeLat}&lon=${activeLon}`,
      `weather_${activeLat.toFixed(3)}_${activeLon.toFixed(3)}`,
      3600
    );
    latestWeather = data;

    const t = document.getElementById("temp");
    const r = document.getElementById("rain");
    const h = document.getElementById("humidity");
    const w = document.getElementById("wind");

    if (t) t.innerText = `${data.temperature ?? "--"}°C`;
    if (r) r.innerText = `${Number(data.rainfall ?? 0).toFixed(1)} mm`;
    if (h) h.innerText = `${data.humidity ?? "--"}%`;
    if (w) w.innerText = `${Number(data.wind_speed ?? 0).toFixed(1)} m/s`;

    updateRiskFromWeather(data);
    updateLastSyncStamp("Weather synced");
  } catch (e) {
    console.log("Weather error", e);
    updateLastSyncStamp("Sync delayed");
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

async function loadRiverMarkers() {
  if (!map || !riverLayer) return;
  try {
    const data = await fetchJsonCached(`${BACKEND_URL}/api/rivers`, "rivers_master", 86400);
    if (!Array.isArray(data.rivers)) throw new Error("Rivers payload missing array");

    riversCache = data.rivers;
    riverLayer.clearLayers();

    riversCache.forEach((river) => {
      const lat = parseFloat(river.lat);
      const lon = parseFloat(river.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon) || !isStrictIndia(lat, lon)) return;

      const level = String(river.risk_level || "").toLowerCase();
      let color = "#5cb85c";
      if (level === "high") color = "#d9534f";
      else if (level === "moderate") color = "#f0ad4e";

      const marker = L.circleMarker([lat, lon], {
        radius: level === "high" ? 7 : 6,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 1.5,
      });

      marker.bindPopup(
        `<strong>${escapeHtml(river.name || "River")}</strong><br>` +
          `Point: ${escapeHtml(river.city || "Unknown")}, ${escapeHtml(river.state || "Unknown")}<br>` +
          `Flow: ${escapeHtml(river.flow_direction || "Variable")}<br>` +
          `Risk: <strong>${escapeHtml((river.risk_level || "low").toUpperCase())}</strong> (${escapeHtml(
            river.risk_score ?? "--"
          )})<br>` +
          `Rain: ${escapeHtml(river.weather?.rainfall ?? "--")} mm | Humidity: ${escapeHtml(river.weather?.humidity ?? "--")}%<br>` +
          `Risk Source: ${escapeHtml(river.source || "unknown")}`
      );

      marker.on("click", () => {
        selectedRiverId = river.id;
        showRiverFlowDirection(river);
        renderRiverDetails(river.id);
      });

      marker.addTo(riverLayer);
    });

    renderRiversTab();
  } catch (err) {
    console.log("Rivers error", err);
    const summary = document.getElementById("rivers-summary");
    const list = document.getElementById("rivers-list");
    if (summary) summary.innerHTML = "Unable to load rivers.";
    if (list) list.innerHTML = `Rivers API error: ${escapeHtml(err?.message || "unknown error")}`;
  }
}

function isStrictIndia(lat, lon) {
  return lat >= 7.5 && lat <= 37.2 && lon >= 68.0 && lon <= 96.2;
}

function riverLabel(level) {
  const s = String(level || "low").toLowerCase();
  if (s === "high") return "HIGH";
  if (s === "moderate") return "MODERATE";
  return "LOW";
}

function riverColor(level) {
  const s = String(level || "low").toLowerCase();
  if (s === "high") return "#ff5b6c";
  if (s === "moderate") return "#ffb84a";
  return "#32d58b";
}

function directionVector(flowText) {
  const t = String(flowText || "").toLowerCase();
  if (t.includes("west to east")) return [0, 0.45];
  if (t.includes("east to west")) return [0, -0.45];
  if (t.includes("north to south")) return [-0.45, 0];
  if (t.includes("south to north")) return [0.45, 0];
  if (t.includes("north-west to south-east")) return [-0.35, 0.35];
  if (t.includes("north-east to south-west")) return [-0.35, -0.35];
  if (t.includes("south-west to north-east")) return [0.35, 0.35];
  return [0, 0.3];
}

function showRiverFlowDirection(river) {
  if (!map || !riverFlowLayer) return;
  riverFlowLayer.clearLayers();
  const lat = Number(river.lat);
  const lon = Number(river.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const [dLat, dLon] = directionVector(river.flow_direction);
  const to = [lat + dLat, lon + dLon];
  L.polyline(
    [
      [lat, lon],
      to,
    ],
    { color: "#1276cf", weight: 4, opacity: 0.85 }
  ).addTo(riverFlowLayer);

  L.marker(to, {
    icon: L.divIcon({
      className: "flow-arrow-icon",
      html: '<div style="font-size:18px;color:#1276cf;font-weight:700;">➤</div>',
      iconSize: [18, 18],
    }),
  })
    .addTo(riverFlowLayer)
    .bindPopup(`Flow Direction: ${escapeHtml(river.flow_direction || "Variable")}`);
}

function generateRiverSeries(river) {
  const base = 92 + (Number(river.risk_score) || 2) * 1.4;
  const trend = String(river.risk_level || "").toLowerCase() === "high" ? 0.35 : String(river.risk_level || "").toLowerCase() === "moderate" ? 0.18 : 0.08;
  const series = [];
  for (let i = 0; i < 8; i += 1) {
    const wave = Math.sin(i * 0.9) * 0.28;
    series.push(Number((base + wave + trend * i).toFixed(2)));
  }
  return series;
}

function drawRiverChart(series, thresholds, level) {
  const canvas = document.getElementById("river-chart");
  if (!canvas || !Array.isArray(series) || !series.length) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 560;
  const height = 180;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const minVal = Math.min(...series, thresholds.warning - 1);
  const maxVal = Math.max(...series, thresholds.extreme + 1);
  const left = 44;
  const right = width - 16;
  const top = 16;
  const bottom = height - 24;
  const innerW = right - left;
  const innerH = bottom - top;
  const mapX = (i) => left + (i / (series.length - 1)) * innerW;
  const mapY = (v) => bottom - ((v - minVal) / (maxVal - minVal || 1)) * innerH;

  ctx.strokeStyle = "rgba(180,220,255,.24)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (i / 4) * innerH;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  const lines = [
    { label: "Warning", value: thresholds.warning, color: "#ffb84a" },
    { label: "Danger", value: thresholds.danger, color: "#ff7a45" },
    { label: "Extreme", value: thresholds.extreme, color: "#ff4d4f" },
  ];
  lines.forEach((line) => {
    const y = mapY(line.value);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  });

  ctx.strokeStyle = riverColor(level);
  ctx.lineWidth = 3;
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = mapX(i);
    const y = mapY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "rgba(78,164,255,.18)";
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = mapX(i);
    const y = mapY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();
}

function renderRiversTab() {
  const summary = document.getElementById("rivers-summary");
  const list = document.getElementById("rivers-list");
  if (!summary || !list) return;

  if (!Array.isArray(riversCache) || !riversCache.length) {
    summary.innerHTML = "River data loading...";
    list.innerHTML = "No river data available yet.";
    loadRiverMarkers();
    return;
  }

  const high = riversCache.filter((r) => String(r.risk_level).toLowerCase() === "high").length;
  const moderate = riversCache.filter((r) => String(r.risk_level).toLowerCase() === "moderate").length;
  const low = riversCache.length - high - moderate;

  summary.innerHTML =
    `<p><strong>Total river points:</strong> ${riversCache.length}</p>` +
    `<p><strong>High:</strong> ${high} | <strong>Moderate:</strong> ${moderate} | <strong>Low:</strong> ${low}</p>` +
    `<p>Tap any river point on map to inspect local conditions.</p>`;

  list.innerHTML = riversCache
    .slice(0, 80)
    .map(
      (r) =>
        `<p><button onclick="selectRiver('${escapeHtml(r.id)}')">${escapeHtml(r.name)} - ${escapeHtml(
          r.city || "Unknown"
        )}, ${escapeHtml(r.state || "Unknown")}</button> | <strong>${riverLabel(r.risk_level)}</strong> (${escapeHtml(r.risk_score ?? "--")})</p>`
    )
    .join("");

  const targetId = selectedRiverId || riversCache[0]?.id;
  if (targetId) renderRiverDetails(targetId);
}

function renderRiverDetails(riverId) {
  const detail = document.getElementById("river-detail");
  if (!detail || !Array.isArray(riversCache) || !riversCache.length) return;

  const river = riversCache.find((r) => String(r.id) === String(riverId)) || riversCache[0];
  if (!river) return;

  selectedRiverId = river.id;
  const series = generateRiverSeries(river);
  const thresholds = {
    warning: Number((Math.min(...series) + 2.2).toFixed(2)),
    danger: Number((Math.min(...series) + 3.4).toFixed(2)),
    extreme: Number((Math.min(...series) + 5.1).toFixed(2)),
  };
  const trendDelta = Number((series[series.length - 1] - series[0]).toFixed(2));
  const trendText = trendDelta > 0.4 ? "Rising by tomorrow" : trendDelta < -0.2 ? "Falling by tomorrow" : "No major change by tomorrow";

  detail.innerHTML = [
    `<h3>${escapeHtml(river.name || "River")} (${escapeHtml(river.city || "Unknown")})</h3>`,
    `<p><strong>State:</strong> ${escapeHtml(river.state || "Unknown")} | <strong>Basin:</strong> ${escapeHtml(
      river.basin || "Unknown"
    )}</p>`,
    `<p><strong>Length:</strong> ${escapeHtml(river.length_km ?? "--")} km | <strong>Risk:</strong> ${riverLabel(
      river.risk_level
    )} (${escapeHtml(river.risk_score ?? "--")})</p>`,
    `<p><strong>Flow Direction:</strong> ${escapeHtml(river.flow_direction || "Variable")}</p>`,
    `<p><strong>Nearest flood signal:</strong> ${escapeHtml(river.nearest_flood_signal_km ?? "--")} km</p>`,
    `<p><strong>Coordinates:</strong> ${Number(river.lat).toFixed(4)}, ${Number(river.lon).toFixed(4)}</p>`,
  ].join("");

  const nameEl = document.getElementById("river-name");
  const metaEl = document.getElementById("river-meta");
  const badgeEl = document.getElementById("river-change-badge");
  const thresholdEl = document.getElementById("river-thresholds");

  if (nameEl) nameEl.innerText = `${river.name} River`;
  if (metaEl) {
    metaEl.innerText = `${river.city}, ${river.state} | Current level ${series[series.length - 1]} m | Risk ${riverLabel(river.risk_level)}`;
  }
  if (badgeEl) {
    badgeEl.innerText = trendText;
    badgeEl.style.background = trendDelta > 0.4 ? "rgba(255,91,108,.16)" : trendDelta < -0.2 ? "rgba(50,213,139,.18)" : "rgba(88,176,255,.16)";
    badgeEl.style.borderColor = trendDelta > 0.4 ? "rgba(255,91,108,.55)" : trendDelta < -0.2 ? "rgba(50,213,139,.55)" : "rgba(88,176,255,.55)";
    badgeEl.style.color = trendDelta > 0.4 ? "#ffc5cc" : trendDelta < -0.2 ? "#bff4dc" : "#cde9ff";
  }
  if (thresholdEl) {
    thresholdEl.innerHTML = `<span style="color:#ffb84a;">● Warning ${thresholds.warning} m</span>
      <span style="color:#ff7a45;">● Danger ${thresholds.danger} m</span>
      <span style="color:#ff4d4f;">● Extreme ${thresholds.extreme} m</span>`;
  }
  drawRiverChart(series, thresholds, river.risk_level);
}

function selectRiver(riverId) {
  renderRiverDetails(riverId);
  const river = riversCache.find((r) => String(r.id) === String(riverId));
  if (!river || !map) return;
  showRiverFlowDirection(river);
  map.setView([river.lat, river.lon], 8);
}
window.selectRiver = selectRiver;

function setupMapClick() {
  if (!map) return;
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    try {
      const data = await fetchJsonCached(
        `${BACKEND_URL}/api/location-intel?lat=${lat}&lon=${lon}`,
        `location_${lat.toFixed(3)}_${lon.toFixed(3)}`,
        86400
      );
      const weather = data.weather || {};
      const cityName = data.city && data.city !== "Unknown" ? data.city : weather.location || "Unknown";
      const countryName = (data.country || "Unknown") === "IN" ? "India" : data.country || "Unknown";
      latestLocationIntel = data;
      const stateName = data.state || "Unknown";
      const districtName = data.district || "Unknown";
      setActiveLocation(lat, lon, `${cityName}, ${districtName}, ${stateName}`);
      updateLiveLocationDetailsFromIntel(data, lat, lon);

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
      const drivers = data?.drivers || {};
      result.innerHTML = `<strong>${data.risk_label}</strong> (${data.confidence}%)${district}<br>
      Rain ${drivers.rainfall_mm ?? "--"} mm | Humidity ${drivers.humidity ?? "--"}% | Wind ${drivers.wind_speed ?? "--"} m/s`;
      renderPredictionLab(data);
    }
  } catch {
    if (result) result.innerText = "Prediction failed";
  }
}

function initSavedPlaces() {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    savedPlaces = Array.isArray(parsed) ? parsed : [];
  } catch {
    savedPlaces = [];
  }
  renderSavedPlaces();
}

function persistSavedPlaces() {
  localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(savedPlaces.slice(0, 30)));
}

function currentPlaceLabel() {
  const state = latestLocationIntel?.state || "Unknown";
  const city = latestLocationIntel?.city || latestLocationIntel?.district || "Selected Area";
  return `${city}, ${state}`;
}

function saveCurrentPlace() {
  const name = currentPlaceLabel();
  const item = {
    id: `${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    name,
    lat: Number(activeLat.toFixed(6)),
    lon: Number(activeLon.toFixed(6)),
    state: latestLocationIntel?.state || "",
    city: latestLocationIntel?.city || latestLocationIntel?.district || "",
  };
  const exists = savedPlaces.some((p) => Math.abs(p.lat - item.lat) < 0.0001 && Math.abs(p.lon - item.lon) < 0.0001);
  if (exists) {
    updateLastSyncStamp("Place already saved");
    return;
  }
  savedPlaces.unshift(item);
  savedPlaces = savedPlaces.slice(0, 30);
  persistSavedPlaces();
  renderSavedPlaces();
  updateLastSyncStamp("Saved place added");
}
window.saveCurrentPlace = saveCurrentPlace;

function jumpToSavedPlace(id) {
  const p = savedPlaces.find((x) => x.id === id);
  if (!p) return;
  setActiveLocation(Number(p.lat), Number(p.lon), p.name || "Saved Place");
  if (map) map.setView([Number(p.lat), Number(p.lon)], 9);
  refreshAreaData();
  updateLiveLocationDetails(Number(p.lat), Number(p.lon));
}
window.jumpToSavedPlace = jumpToSavedPlace;

function removeSavedPlace(id) {
  savedPlaces = savedPlaces.filter((p) => p.id !== id);
  persistSavedPlaces();
  renderSavedPlaces();
}
window.removeSavedPlace = removeSavedPlace;

function renderSavedPlaces() {
  const box = document.getElementById("saved-places");
  if (!box) return;
  if (!savedPlaces.length) {
    box.innerText = "No saved places yet.";
    return;
  }
  box.innerHTML = savedPlaces
    .map(
      (p) => `<div class="saved-place-item">
<div>
<p><strong>${escapeHtml(p.name || "Saved Place")}</strong></p>
<p class="saved-place-meta">${Number(p.lat).toFixed(4)}, ${Number(p.lon).toFixed(4)}</p>
</div>
<div class="saved-place-actions">
<button class="jump" onclick="jumpToSavedPlace('${escapeHtml(p.id)}')">Open</button>
<button class="remove" onclick="removeSavedPlace('${escapeHtml(p.id)}')">Delete</button>
</div>
</div>`
    )
    .join("");
}
window.runPrediction = runPrediction;

function riskBand(score) {
  if (score >= 0.72) return "Red Zone";
  if (score >= 0.48) return "Amber Zone";
  if (score >= 0.28) return "Watch Zone";
  return "Safe Zone";
}

function drawPredictionChart(points) {
  const canvas = document.getElementById("prediction-chart");
  if (!canvas || !Array.isArray(points) || !points.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 560;
  const height = 170;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const vals = points.map((x) => Number(x.score || 0) * 100);
  const maxVal = Math.max(100, ...vals);
  const left = 34;
  const right = width - 12;
  const top = 14;
  const bottom = height - 24;
  const w = right - left;
  const h = bottom - top;
  const xAt = (i) => left + (i / Math.max(vals.length - 1, 1)) * w;
  const yAt = (v) => bottom - (v / maxVal) * h;

  ctx.strokeStyle = "rgba(27,93,157,.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#156fc2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = xAt(i);
    const y = yAt(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

async function renderPredictionLab(predData) {
  const intel = document.getElementById("prediction-intel");
  const actions = document.getElementById("prediction-actions");
  const trajBox = document.getElementById("prediction-trajectory");
  if (!intel || !actions) return;
  const d = predData?.drivers || {};
  const score = Number(predData?.score || 0);

  let traj = [];
  let runwayHours = 24;
  let maxScorePct = (score * 100).toFixed(1);
  try {
    const fr = await fetch(`${BACKEND_URL}/api/prediction-trajectory?lat=${activeLat}&lon=${activeLon}&slots=8`);
    const fd = await fr.json();
    traj = Array.isArray(fd.trajectory) ? fd.trajectory : [];
    runwayHours = Number(fd.runway_hours ?? 24);
    maxScorePct = Number(fd.max_score_pct ?? maxScorePct).toFixed(1);
    drawPredictionChart(traj);
  } catch {}

  const district = d.nearest_district || latestLocationIntel?.district || "Unknown";

  intel.innerHTML = [
    `<p><strong>Risk Band:</strong> ${riskBand(score)} | <strong>Model Score:</strong> ${maxScorePct} / 100</p>`,
    `<p><strong>Early-Warning Runway:</strong> ${runwayHours}h before modeled escalation window</p>`,
    `<p><strong>Driver Stack:</strong> District ${escapeHtml(district)}, Hotspots ${escapeHtml(d.nearby_hotspots ?? "--")}, Drainage ${
      d.ward_drainage_capacity ?? "--"
    }</p>`,
    `<p><strong>Engine:</strong> trajectory derived from forecast slots + predict-risk model at selected location.</p>`,
  ].join("");

  if (trajBox) {
    if (!traj.length) {
      trajBox.innerHTML = "Trajectory unavailable.";
    } else {
      trajBox.innerHTML = traj
        .map(
          (t) =>
            `<p>${escapeHtml(t.timestamp || "--")} | Score ${(Number(t.score || 0) * 100).toFixed(1)} | ${escapeHtml(
              t.risk_label || "Unknown"
            )} (${escapeHtml(t.confidence ?? "--")}%)</p>`
        )
        .join("");
    }
  }

  const severity = score >= 0.72 ? "High" : score >= 0.48 ? "Moderate" : "Low";
  const actionList =
    severity === "High"
      ? ["Move critical assets above flood line now.", "Avoid inter-city travel for next 6h.", "Activate family emergency check-in."]
      : severity === "Moderate"
      ? ["Prepare go-bag and backup power.", "Track alert feed every 2h.", "Avoid low-lying routes at night."]
      : ["Keep monitoring enabled.", "Check rivers tab twice daily.", "Save nearest shelters and safe route."];

  actions.innerHTML = `<p><strong>Adaptive Action Plan (${severity})</strong></p><p>${actionList.join(" ")}</p>`;
}

function setupPredictionSimulator() {
  const rain = document.getElementById("sim-rain");
  const hum = document.getElementById("sim-humidity");
  const rainVal = document.getElementById("sim-rain-val");
  const humVal = document.getElementById("sim-humidity-val");
  if (rain && rainVal) rain.addEventListener("input", () => (rainVal.innerText = `${rain.value} mm`));
  if (hum && humVal) hum.addEventListener("input", () => (humVal.innerText = `${hum.value}%`));
}

async function runWhatIfSimulation() {
  const out = document.getElementById("prediction-sim-result");
  const rain = Number(document.getElementById("sim-rain")?.value || 0);
  const hum = Number(document.getElementById("sim-humidity")?.value || 70);
  if (out) out.innerText = "Running simulation...";
  try {
    const res = await fetch(`${BACKEND_URL}/api/predict-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rainfall_mm_24h: rain,
        humidity: hum,
        temperature_c: latestWeather?.temperature || 28,
        wind_speed: latestWeather?.wind_speed || 2,
        lat: activeLat,
        lon: activeLon,
      }),
    });
    const data = await res.json();
    if (out) {
      out.innerHTML = `<strong>${data.risk_label}</strong> (${data.confidence}%) | ${riskBand(Number(data.score || 0))}`;
    }
  } catch {
    if (out) out.innerText = "Simulation failed.";
  }
}
window.runWhatIfSimulation = runWhatIfSimulation;

async function loadAlerts() {
  const box = document.getElementById("alerts-container");
  const intel = document.getElementById("alerts-intel");
  if (!box) return;
  box.innerHTML = "Loading live alerts...";
  if (intel) intel.innerHTML = "Generating advanced risk intelligence...";

  try {
    const data = await fetchJsonCached(
      `${BACKEND_URL}/api/alerts?lat=${activeLat}&lon=${activeLon}`,
      `alerts_${activeLat.toFixed(3)}_${activeLon.toFixed(3)}`,
      1800
    );
    if (!Array.isArray(data.alerts) || !data.alerts.length) {
      box.innerHTML = "No alerts available.";
      if (intel) intel.innerHTML = "No active alert intelligence right now.";
      return;
    }

    const highCount = data.alerts.filter((a) => String(a.severity).toLowerCase() === "high").length;
    const mediumCount = data.alerts.filter((a) => String(a.severity).toLowerCase() === "medium").length;
    const pulseScore = Math.min(100, highCount * 35 + mediumCount * 18 + data.alerts.length * 8);
    const mode = pulseScore >= 70 ? "CRITICAL WATCH" : pulseScore >= 40 ? "ACTIVE WATCH" : "STABLE WATCH";
    if (intel) {
      intel.innerHTML = `<p><strong>Flood Pulse Score:</strong> ${pulseScore}/100 | <strong>Status:</strong> ${mode}</p>
      <p><strong>High:</strong> ${highCount} | <strong>Medium:</strong> ${mediumCount} | <strong>Total signals:</strong> ${data.alerts.length}</p>
      <p><strong>New concept:</strong> Neighborhood micro-watch mode combines hotspot density + readiness + near-term rain shift.</p>`;
    }

    box.innerHTML = data.alerts
      .map((a) => {
        const sev = (a.severity || "low").toUpperCase();
        const color = sev === "HIGH" ? "#ff5b6c" : sev === "MEDIUM" ? "#ffb84a" : "#32d58b";
        const eta = sev === "HIGH" ? "Action in 0-2h" : sev === "MEDIUM" ? "Action in 2-6h" : "Monitor in 6-12h";
        return `<div class="alert-card" style="border-left:4px solid ${color};">
          <p><strong>[${sev}] ${a.title}</strong><br>${a.message}</p>
          <p><strong>Recommended Window:</strong> ${eta}</p>
          <small>Source: ${a.source || "engine"}</small>
        </div>`;
      })
      .join("");
  } catch (e) {
    box.innerHTML = "Unable to load alerts.";
    if (intel) intel.innerHTML = "Unable to compute alert intelligence.";
    console.log("Alerts error", e);
  }
}

function drawForecastChart(rows) {
  const canvas = document.getElementById("forecast-chart");
  if (!canvas || !Array.isArray(rows) || !rows.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 560;
  const height = 170;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const values = rows.map((r) => Number(r.rainfall_mm) || 0);
  const maxVal = Math.max(...values, 5);
  const left = 36;
  const right = width - 12;
  const top = 14;
  const bottom = height - 22;
  const w = right - left;
  const h = bottom - top;
  const xAt = (i) => left + (i / Math.max(rows.length - 1, 1)) * w;
  const yAt = (v) => bottom - (v / maxVal) * h;

  ctx.strokeStyle = "rgba(27,93,157,.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (i / 4) * h;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1f8ceb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xAt(i);
    const y = yAt(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

async function loadForecast() {
  const box = document.getElementById("forecast-results");
  const headline = document.getElementById("forecast-headline");
  if (box) box.innerHTML = "Loading forecast...";
  if (headline) headline.innerHTML = "Computing forecast intelligence...";

  try {
    const data = await fetchJsonCached(
      `${BACKEND_URL}/api/flood-forecast?lat=${activeLat}&lon=${activeLon}`,
      `forecast_${activeLat.toFixed(3)}_${activeLon.toFixed(3)}`,
      1800
    );

    if (!box) return;
    if (!Array.isArray(data.forecast)) {
      box.innerHTML = "Forecast unavailable.";
      if (headline) headline.innerHTML = "No forecast intelligence available.";
      return;
    }

    const rows = data.forecast.slice(0, 10);
    const peak = rows.reduce((m, r) => ((r.rainfall_mm || 0) > (m.rainfall_mm || 0) ? r : m), rows[0]);
    const totalRain = rows.reduce((a, r) => a + (Number(r.rainfall_mm) || 0), 0).toFixed(1);
    const risingSlots = rows.filter((r) => (Number(r.rainfall_mm) || 0) >= 10).length;
    const confidence = Math.max(62, 98 - risingSlots * 4);
    drawForecastChart(rows);
    if (headline) {
      headline.innerHTML = `<p><strong>Rain Outlook:</strong> ${totalRain} mm in next windows | <strong>Peak window:</strong> ${
        peak.timestamp || "N/A"
      }</p>
      <p><strong>Impact Confidence:</strong> ${confidence}% | <strong>Escalation windows:</strong> ${risingSlots}</p>
      <p><strong>New concept:</strong> Route-Aware Rain Shift highlights if travel corridors are likely to worsen in next 6h.</p>`;
    }

    box.innerHTML =
      `<p><strong>Next windows total:</strong> ${totalRain} mm | <strong>Peak:</strong> ${peak.rainfall_mm ?? 0} mm at ${
        peak.timestamp || "N/A"
      }</p>` +
      rows
        .map((f) => {
          const action = (Number(f.rainfall_mm) || 0) >= 15 ? "Avoid travel" : (Number(f.rainfall_mm) || 0) >= 5 ? "Caution" : "Normal";
          return `<p>${f.timestamp}: <strong>${f.rainfall_mm} mm</strong>, Humidity ${f.humidity ?? "--"}% - ${f.risk} | <strong>${action}</strong></p>`;
        })
        .join("");
  } catch (e) {
    if (box) box.innerHTML = "Forecast request failed.";
    if (headline) headline.innerHTML = "Unable to generate forecast intelligence.";
    console.log("Forecast error", e);
  }
}
window.loadForecast = loadForecast;


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
    }
  } catch (e) {
    if (box) box.innerText = "Unable to compute route now.";
    console.log("Route error", e);
  }
}

function clearTripRoutesOnMap() {
  if (!map) return;
  tripRouteLayers.forEach((l) => {
    if (l && map.hasLayer(l)) map.removeLayer(l);
  });
  tripEndpointMarkers.forEach((m) => {
    if (m && map.hasLayer(m)) map.removeLayer(m);
  });
  tripRouteLayers = [];
  tripEndpointMarkers = [];
}

function tripColor(level, idx) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return idx === 0 ? "#d63b48" : "#bf6770";
  if (l === "moderate") return idx === 0 ? "#f29b1f" : "#d7ad61";
  return idx === 0 ? "#18b979" : "#66c3a0";
}

async function planInterstateTrip() {
  const origin = (document.getElementById("trip-origin")?.value || "").trim();
  const destination = (document.getElementById("trip-destination")?.value || "").trim();
  const status = document.getElementById("trip-status");
  const list = document.getElementById("trip-routes");

  if (!origin || !destination) {
    if (status) status.innerText = "Please enter both origin and destination.";
    return;
  }
  if (status) status.innerText = "Computing safest routes...";
  if (list) list.innerHTML = "Loading route options...";

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/interstate-safe-routes?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
    );
    const data = await res.json();
    if (!data || data.status !== "success" || !Array.isArray(data.routes) || !data.routes.length) {
      if (status) status.innerText = data?.message || "No route options available.";
      if (list) list.innerHTML = "Try another origin/destination.";
      return;
    }

    clearTripRoutesOnMap();
    const recommended = data.recommended_route_id;
    data.routes.forEach((r, idx) => {
      const latLngs = (r.coordinates || []).map((p) => [Number(p[0]), Number(p[1])]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (latLngs.length < 2 || !map) return;
      const line = L.polyline(latLngs, {
        color: tripColor(r.flood_risk_level, idx),
        weight: r.route_id === recommended ? 6 : 4,
        opacity: r.route_id === recommended ? 0.95 : 0.7,
        dashArray: r.route_id === recommended ? "" : "6,6",
      }).addTo(map);
      line.bindPopup(
        `Route ${r.route_id}<br>Risk: ${String(r.flood_risk_level || "low").toUpperCase()} (${r.flood_risk_score})<br>Distance: ${r.distance_km} km<br>ETA: ${r.duration_min} min`
      );
      tripRouteLayers.push(line);
    });

    const start = data.origin;
    const end = data.destination;
    if (map && start && end) {
      const m1 = L.marker([start.lat, start.lon]).addTo(map).bindPopup(`Origin: ${escapeHtml(origin)}`);
      const m2 = L.marker([end.lat, end.lon]).addTo(map).bindPopup(`Destination: ${escapeHtml(destination)}`);
      tripEndpointMarkers.push(m1, m2);
      const all = [...tripRouteLayers.map((l) => l.getBounds()), L.latLngBounds([[start.lat, start.lon], [end.lat, end.lon]])];
      const merged = all.reduce((acc, b) => (acc ? acc.extend(b) : b), null);
      if (merged) map.fitBounds(merged, { padding: [30, 30] });
    }

    if (status) {
      const best = data.routes.find((r) => r.route_id === recommended) || data.routes[0];
      status.innerHTML = `Best route: <strong>#${best.route_id}</strong> | Risk <strong>${String(best.flood_risk_level).toUpperCase()}</strong> (${best.flood_risk_score}) | ${best.distance_km} km`;
    }
    if (list) {
      list.innerHTML = data.routes
        .map(
          (r) =>
            `<p><strong>Route ${r.route_id}${r.route_id === recommended ? " (Recommended)" : ""}</strong><br>Risk: ${String(
              r.flood_risk_level
            ).toUpperCase()} (${r.flood_risk_score}) | Distance: ${r.distance_km} km | ETA: ${r.duration_min} min</p>`
        )
        .join("");
    }
  } catch (e) {
    if (status) status.innerText = "Trip planning service unavailable.";
    if (list) list.innerHTML = "Unable to fetch routes right now.";
    console.log("Trip planner error", e);
  }
}

function setupTripPlanner() {
  const btn = document.getElementById("plan-trip-btn");
  if (btn) btn.addEventListener("click", planInterstateTrip);
}


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
}
window.openWhatsAppSOS = openWhatsAppSOS;

async function triggerSOS() {
  await loadSOSPanel();
  alert("SOS ready. Share it now using Copy, Share, or WhatsApp.");
}
window.triggerSOS = triggerSOS;

async function loadNews() {
  const box = document.getElementById("news-list");
  if (box) box.innerHTML = "Loading news...";

  try {
    const langSel = document.getElementById("news-lang");
    const lang = langSel?.value || "en";
    const data = await fetchJsonCached(
      `${BACKEND_URL}/api/news?lang=${encodeURIComponent(lang)}`,
      `news_${lang}`,
      7200
    );

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
  if (refresh)
    refresh.addEventListener("click", () => {
      loadRadarSource();
      loadRadarInsights();
    });
}

async function loadRadarSource() {
  const select = document.getElementById("radar-source");
  const frame = document.getElementById("radar-frame");
  const riverMapEl = document.getElementById("radar-river-map");
  const status = document.getElementById("radar-status");
  if (!select || !frame || !riverMapEl) return;

  const key = select.value || "windy-rain";
  if (key === "river-flow") {
    frame.style.display = "none";
    riverMapEl.style.display = "block";
    await loadRadarRiverMap();
    if (status) status.innerText = "Radar mode: Rivers Movement";
    return;
  }

  riverMapEl.style.display = "none";
  frame.style.display = "block";
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

function flowArrow(flowDirection) {
  const t = String(flowDirection || "").toLowerCase();
  if (t.includes("west to east")) return "➡";
  if (t.includes("east to west")) return "⬅";
  if (t.includes("north to south")) return "⬇";
  if (t.includes("south to north")) return "⬆";
  if (t.includes("north-west to south-east")) return "↘";
  if (t.includes("north-east to south-west")) return "↙";
  if (t.includes("south-west to north-east")) return "↗";
  if (t.includes("south-east to north-west")) return "↖";
  return "➜";
}

async function loadRadarRiverMap() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/rivers`);
    const data = await res.json();
    const rivers = Array.isArray(data.rivers) ? data.rivers : [];
    if (!rivers.length) return;

    if (!radarRiverMap) {
      radarRiverMap = L.map("radar-river-map", { zoomControl: true }).setView([activeLat, activeLon], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(radarRiverMap);
      radarRiverLayer = L.layerGroup().addTo(radarRiverMap);
    }
    if (radarRiverLayer) radarRiverLayer.clearLayers();
    if (radarRiverAnimTimer) {
      clearInterval(radarRiverAnimTimer);
      radarRiverAnimTimer = null;
    }

    const nearest = rivers
      .map((r) => ({ ...r, d: haversineKm(activeLat, activeLon, Number(r.lat), Number(r.lon)) }))
      .filter((r) => Number.isFinite(r.d))
      .sort((a, b) => a.d - b.d)
      .slice(0, 20);

    const movers = [];
    nearest.forEach((r) => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const [dLat, dLon] = directionVector(r.flow_direction);
      const to = [lat + dLat * 0.6, lon + dLon * 0.6];
      const color = String(r.risk_level || "").toLowerCase() === "high" ? "#d9534f" : String(r.risk_level || "").toLowerCase() === "moderate" ? "#f0ad4e" : "#2bb673";
      L.polyline(
        [
          [lat, lon],
          to,
        ],
        { color, weight: 3, opacity: 0.9 }
      ).addTo(radarRiverLayer);
      L.circleMarker([lat, lon], { radius: 4, color, fillColor: color, fillOpacity: 0.9 }).addTo(radarRiverLayer).bindPopup(
        `${escapeHtml(r.name)} ${flowArrow(r.flow_direction)}<br>${escapeHtml(r.flow_direction || "Variable")}<br>Risk: ${escapeHtml(
          String(r.risk_level || "low").toUpperCase()
        )}`
      );

      const pulse = L.circleMarker([lat, lon], {
        radius: 3,
        color: "#ffffff",
        fillColor: "#ffffff",
        fillOpacity: 0.95,
        weight: 1,
      }).addTo(radarRiverLayer);
      const speed = String(r.risk_level || "").toLowerCase() === "high" ? 0.03 : String(r.risk_level || "").toLowerCase() === "moderate" ? 0.02 : 0.012;
      movers.push({ marker: pulse, from: [lat, lon], to, t: Math.random(), speed });
    });

    radarRiverAnimTimer = setInterval(() => {
      movers.forEach((m) => {
        m.t += m.speed;
        if (m.t >= 1) m.t = 0;
        const lat = m.from[0] + (m.to[0] - m.from[0]) * m.t;
        const lon = m.from[1] + (m.to[1] - m.from[1]) * m.t;
        m.marker.setLatLng([lat, lon]);
      });
    }, 120);

    const pts = nearest.map((r) => [Number(r.lat), Number(r.lon)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length) radarRiverMap.fitBounds(pts, { padding: [20, 20] });
    setTimeout(() => radarRiverMap.invalidateSize(), 120);

    if (radarRiverRefreshTimer) clearInterval(radarRiverRefreshTimer);
    radarRiverRefreshTimer = setInterval(() => {
      const key = document.getElementById("radar-source")?.value || "";
      if (key === "river-flow") loadRadarRiverMap();
    }, 300000);
  } catch (e) {
    console.log("Radar river map error", e);
  }
}


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
  loadFeedbackManager();
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
