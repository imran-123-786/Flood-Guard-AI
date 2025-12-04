// ================================
// 🌊 Flood Guard - Frontend Logic
// ================================

const BACKEND_URL = "http://localhost:5000";

let userLat = null;
let userLon = null;
let map = null;
let latestWeather = null;

// -------------------------
// TAB SWITCHING
// -------------------------
function showSection(id) {
    // Switch visible section
    document.querySelectorAll(".section").forEach(sec => {
        sec.classList.toggle("active", sec.id === id);
    });

    // Highlight active nav button
    document.querySelectorAll(".nav-menu button").forEach(btn => {
        const onclickAttr = btn.getAttribute("onclick") || "";
        if (onclickAttr.includes(`'${id}'`)) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}
window.showSection = showSection; // needed for inline onclick in HTML

// -------------------------
// GEOLOCATION + DASHBOARD
// -------------------------
function initApp() {
    // Load saved volunteers & history early
    loadVolunteers();
    loadHistory();

    // Attach route button
    const routeBtn = document.getElementById("find-route");
    if (routeBtn) {
        routeBtn.addEventListener("click", findSafeRoute);
    }

    // Try to get user location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;

                const locSpan = document.getElementById("user-location");
                if (locSpan) {
                    locSpan.textContent = `${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
                }

                initMap();
                fetchWeather();
                fetchShelters();
                monitorBattery();
            },
            (err) => {
                console.warn("Geolocation error:", err);
                fallbackInit();
            }
        );
    } else {
        fallbackInit();
    }

    // Listen for offline / online (optional)
    window.addEventListener("offline", () => addHistory("system", "Went offline - showing last cached data."));
    window.addEventListener("online", () => addHistory("system", "Back online - live updates resumed."));
}

function fallbackInit() {
    // Default to India center if no GPS
    userLat = 20.5937;
    userLon = 78.9629;
    const locSpan = document.getElementById("user-location");
    if (locSpan) {
        locSpan.textContent = "Location access denied (using India default)";
    }
    initMap();
    fetchWeather();
    fetchShelters();
    monitorBattery();
}

// -------------------------
// LEAFLET MAP
// -------------------------
function initMap() {
    if (typeof L === "undefined") {
        console.error("Leaflet not loaded");
        return;
    }
    const mapDiv = document.getElementById("map");
    if (!mapDiv) return;

    if (map) {
        map.setView([userLat, userLon], 12);
        return;
    }

    map = L.map("map").setView([userLat, userLon], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
    }).addTo(map);

    L.marker([userLat, userLon]).addTo(map).bindPopup("📍 You are here").openPopup();
}

// -------------------------
// WEATHER FETCH
// -------------------------
async function fetchWeather() {
    try {
        const url = `${BACKEND_URL}/api/weather?lat=${userLat}&lon=${userLon}`;
        const res = await fetch(url);
        const data = await res.json();

        latestWeather = data;

        const tempEl = document.getElementById("temp");
        const rainEl = document.getElementById("rain");
        const humEl = document.getElementById("humidity");

        if (tempEl) tempEl.textContent = `${data.temperature ?? "--"}°C`;
        if (rainEl) rainEl.textContent = `${data.rainfall ?? 0} mm`;
        if (humEl) humEl.textContent = `${data.humidity ?? "--"}%`;

        // Simple risk calculation for dashboard
        updateRiskFromWeather(data);

        addHistory("weather", `Updated weather: ${data.temperature}°C, rain ${data.rainfall} mm`);
    } catch (err) {
        console.error("Weather error:", err);
    }
}

function updateRiskFromWeather(data) {
    const rain = data.rainfall || 0;
    const hum = data.humidity || 0;

    let riskLevel = "Low";
    let color = "green";

    if (rain > 80 || hum > 90) {
        riskLevel = "High";
        color = "red";
    } else if (rain > 40 || hum > 80) {
        riskLevel = "Moderate";
        color = "orange";
    }

    const riskText = document.getElementById("risk-text");
    const riskColor = document.getElementById("risk-color");
    if (riskText) riskText.textContent = riskLevel;
    if (riskColor) riskColor.style.background = color;
}

// -------------------------
// BATTERY STATUS
// -------------------------
function monitorBattery() {
    if (!("getBattery" in navigator)) return;

    navigator.getBattery().then((battery) => {
        function updateBattery() {
            const level = Math.round(battery.level * 100);
            const el = document.getElementById("battery-status");
            if (el) el.textContent = `${level}%`;

            if (level <= 20) {
                addHistory("system", "Battery low - consider using offline mode & power saving.");
            }
        }

        battery.addEventListener("levelchange", updateBattery);
        updateBattery();
    });
}

// -------------------------
// SHELTERS
// -------------------------
async function fetchShelters() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/shelters`);
        const data = await res.json();
        const listDiv = document.getElementById("shelter-list");
        if (!listDiv) return;

        listDiv.innerHTML = "";
        (data.shelters || []).forEach((shelter) => {
            const div = document.createElement("div");
            div.className = "contact-list"; // reuse styling
            div.innerHTML = `<strong>${shelter.name}</strong><br>📍 ${shelter.distance}`;
            listDiv.appendChild(div);
        });
    } catch (err) {
        console.error("Shelter error:", err);
    }
}

// -------------------------
// AI PREDICTION (Backend ML)
// -------------------------
async function runPrediction() {
    const predSpan = document.getElementById("predicted-level");
    if (predSpan) predSpan.textContent = "Running...";

    try {
        // Build basic payload from weather (you can expand for your trained features)
        const payload = {
            rainfall_mm_24h: latestWeather?.rainfall || 0,
            temperature_c: latestWeather?.temperature || 0,
            humidity: latestWeather?.humidity || 0,
            // Add more keys here to match your ML feature_list if needed
        };

        const res = await fetch(`${BACKEND_URL}/api/predict-risk`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.error) {
            if (predSpan) predSpan.textContent = "ML model not available";
            addHistory("ai", `Prediction failed: ${data.error}`);
            return;
        }

        const label = data.risk_label || `Level ${data.predicted_risk_level}`;
        const conf = data.confidence ?? 0;

        if (predSpan) predSpan.textContent = `${label} (${conf}% confidence)`;

        addHistory("ai", `AI prediction: ${label} (${conf}% confidence)`);
    } catch (err) {
        console.error("Prediction error:", err);
        if (predSpan) predSpan.textContent = "Error";
        addHistory("ai", "AI prediction error (check console).");
    }
}
window.runPrediction = runPrediction;

// -------------------------
// SAFE ROUTE (Simple Demo)
// -------------------------
function findSafeRoute() {
    const out = document.getElementById("route-result");
    if (!out) return;

    if (!userLat || !userLon) {
        out.textContent = "Location not available. Allow GPS for routes.";
        return;
    }

    const mapsUrl = `https://www.google.com/maps/search/safe+high+ground+near+me/@${userLat},${userLon},14z`;
    out.innerHTML = `Suggested: move towards higher ground and main roads. <br>
        <a href="${mapsUrl}" target="_blank" style="color:#ffd;">Open in Google Maps</a>`;

    addHistory("route", "User requested safe route suggestion.");
}

// -------------------------
// REPORT FLOOD / DAMAGE
// -------------------------
function submitReport() {
    const textarea = document.getElementById("report-text");
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) {
        alert("Please describe the situation before submitting.");
        return;
    }

    addHistory("report", `User report: ${text}`);
    textarea.value = "";
    alert("Thank you. Your report is logged locally and can be shared with authorities.");
}
window.submitReport = submitReport;

// -------------------------
// SOS EMERGENCY
// -------------------------
function triggerSOS() {
    const risk = document.getElementById("risk-text")?.textContent || "Unknown";
    const latText = userLat ? userLat.toFixed(5) : "Unknown";
    const lonText = userLon ? userLon.toFixed(5) : "Unknown";

    const msg = `🚨 SOS FLOOD ALERT\nLocation: https://www.google.com/maps?q=${latText},${lonText}\nRisk: ${risk}\n\nPlease send help immediately.`;

    // Open WhatsApp share
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

    // Play alert sound
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
    audio.play().catch(() => {});

    addHistory("sos", "SOS triggered by user.");
}
window.triggerSOS = triggerSOS;

// -------------------------
// COMMUNITY VOLUNTEERS
// -------------------------
function loadVolunteers() {
    const container = document.getElementById("volunteer-list");
    if (!container) return;

    const data = JSON.parse(localStorage.getItem("volunteers") || "[]");
    if (data.length === 0) {
        container.textContent = "No volunteers added yet.";
        return;
    }

    container.innerHTML = "";
    data.forEach((v) => {
        const div = document.createElement("div");
        div.className = "contact-list";
        div.innerHTML = `
            <strong>${v.name}</strong> (${v.area})<br>
            📞 ${v.phone}
        `;
        container.appendChild(div);
    });
}

function addVolunteer() {
    const name = prompt("Volunteer Name:");
    if (!name) return;

    const area = prompt("Area / Locality:");
    if (!area) return;

    const phone = prompt("Phone Number:");
    if (!phone) return;

    const existing = JSON.parse(localStorage.getItem("volunteers") || "[]");
    existing.push({ name, area, phone });
    localStorage.setItem("volunteers", JSON.stringify(existing));

    loadVolunteers();
    alert("Volunteer added. Thank you for supporting the community ❤️");
}
window.addVolunteer = addVolunteer;

// -------------------------
// HISTORY (LOCAL STORAGE)
// -------------------------
function addHistory(type, message) {
    const now = new Date().toLocaleString();
    const entry = { time: now, type, message };

    const data = JSON.parse(localStorage.getItem("history") || "[]");
    data.unshift(entry); // newest first
    localStorage.setItem("history", JSON.stringify(data));

    renderHistory();
}

function loadHistory() {
    renderHistory();
}

function renderHistory() {
    const box = document.getElementById("history-data");
    if (!box) return;

    const data = JSON.parse(localStorage.getItem("history") || "[]");
    if (data.length === 0) {
        box.textContent = "No data yet.";
        return;
    }

    box.innerHTML = "";
    data.forEach((entry) => {
        const div = document.createElement("div");
        div.className = "contact-list";
        div.innerHTML = `<strong>[${entry.type}] ${entry.time}</strong><br>${entry.message}`;
        box.appendChild(div);
    });
}

// -------------------------
// START APP
// -------------------------
window.addEventListener("DOMContentLoaded", initApp);
