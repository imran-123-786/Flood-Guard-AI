// js/app.js

const BACKEND_URL = "http://localhost:5000";

let userLat = null;
let userLon = null;
let map = null;
let latestWeather = null;

// ---------------- TAB SWITCHING ----------------
function showSection(id) {
    document.querySelectorAll(".section").forEach(sec => {
        sec.classList.toggle("active", sec.id === id);
    });

    document.querySelectorAll(".nav-menu button").forEach(btn => {
        const onclickAttr = btn.getAttribute("onclick") || "";
        if (onclickAttr.includes(`'${id}'`)) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}
window.showSection = showSection;

// ---------------- INIT APP ----------------
function initApp() {
    loadVolunteers();
    renderHistory();

    const routeBtn = document.getElementById("find-route");
    if (routeBtn) {
        routeBtn.addEventListener("click", findSafeRoute);
    }

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

    window.addEventListener("offline", () =>
        addHistory("system", "Went offline - showing cached data only.")
    );
    window.addEventListener("online", () =>
        addHistory("system", "Back online - live updates resumed.")
    );
}

function fallbackInit() {
    userLat = 20.5937;
    userLon = 78.9629;
    const locSpan = document.getElementById("user-location");
    if (locSpan) locSpan.textContent = "Location access denied (using India default)";
    initMap();
    fetchWeather();
    fetchShelters();
    monitorBattery();
}

// ---------------- MAP ----------------
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

// ---------------- WEATHER ----------------
async function fetchWeather() {
    try {
        const res = await fetch(
            `${BACKEND_URL}/api/weather?lat=${userLat}&lon=${userLon}`
        );
        const data = await res.json();

        latestWeather = data;

        const tempEl = document.getElementById("temp");
        const rainEl = document.getElementById("rain");
        const humEl = document.getElementById("humidity");

        if (tempEl) tempEl.textContent = `${data.temperature ?? "--"}°C`;
        if (rainEl) rainEl.textContent = `${data.rainfall ?? 0} mm`;
        if (humEl) humEl.textContent = `${data.humidity ?? "--"}%`;

        updateRiskFromWeather(data);
        addHistory("weather", `Weather: ${data.temperature}°C, rain ${data.rainfall} mm`);
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

// ---------------- BATTERY ----------------
function monitorBattery() {
    if (!("getBattery" in navigator)) return;

    navigator.getBattery().then((battery) => {
        function updateBattery() {
            const level = Math.round(battery.level * 100);
            const el = document.getElementById("battery-status");
            if (el) el.textContent = `${level}%`;

            if (level <= 20) {
                addHistory("system", "Battery low - consider power saving & offline mode.");
            }
        }

        battery.addEventListener("levelchange", updateBattery);
        updateBattery();
    });
}

// ---------------- SHELTERS ----------------
async function fetchShelters() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/shelters`);
        const data = await res.json();
        const listDiv = document.getElementById("shelter-list");
        if (!listDiv) return;

        listDiv.innerHTML = "";
        (data.shelters || []).forEach((shelter) => {
            const div = document.createElement("div");
            div.className = "contact-list";
            div.innerHTML = `<strong>${shelter.name}</strong><br>📍 ${shelter.distance}`;
            listDiv.appendChild(div);
        });
    } catch (err) {
        console.error("Shelter error:", err);
    }
}

// ---------------- AI PREDICTION ----------------
async function runPrediction() {
    const predSpan = document.getElementById("predicted-level");
    if (predSpan) predSpan.textContent = "Running...";

    try {
        const payload = {
            rainfall_mm_24h: latestWeather?.rainfall || 0,
            temperature_c: latestWeather?.temperature || 0,
            humidity: latestWeather?.humidity || 0,
        };

        const res = await fetch(`${BACKEND_URL}/api/predict-risk`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.error) {
            if (predSpan) predSpan.textContent = "Error: " + data.error;
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
        addHistory("ai", "AI prediction error.");
    }
}
window.runPrediction = runPrediction;

// ---------------- ROUTE ----------------
function findSafeRoute() {
    const out = document.getElementById("route-result");
    if (!out) return;

    if (!userLat || !userLon) {
        out.textContent = "Location not available. Enable GPS.";
        return;
    }

    const mapsUrl = `https://www.google.com/maps/search/high+ground+near+me/@${userLat},${userLon},14z`;
    out.innerHTML = `Suggested: move towards higher ground and main roads.<br>
    <a href="${mapsUrl}" target="_blank" style="color:#ffd;">Open in Google Maps</a>`;

    addHistory("route", "Safe route suggestion requested.");
}

// ---------------- REPORT ----------------
function submitReport() {
    const textarea = document.getElementById("report-text");
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) {
        alert("Please describe the situation before submitting.");
        return;
    }

    addHistory("report", `Report: ${text}`);
    textarea.value = "";
    alert("Thank you. Your report is saved locally and can be shared with authorities.");
}
window.submitReport = submitReport;

// ---------------- SOS ----------------
function triggerSOS() {
    const risk = document.getElementById("risk-text")?.textContent || "Unknown";
    const latText = userLat ? userLat.toFixed(5) : "Unknown";
    const lonText = userLon ? userLon.toFixed(5) : "Unknown";

    const msg = `🚨 SOS FLOOD ALERT\nLocation: https://www.google.com/maps?q=${latText},${lonText}\nRisk: ${risk}\n\nPlease send help immediately.`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
    audio.play().catch(() => {});

    addHistory("sos", "SOS triggered by user.");
}
window.triggerSOS = triggerSOS;

// ---------------- COMMUNITY ----------------
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
        div.innerHTML = `<strong>${v.name}</strong> (${v.area})<br>📞 ${v.phone}`;
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

// ---------------- HISTORY ----------------
function addHistory(type, message) {
    const now = new Date().toLocaleString();
    const entry = { time: now, type, message };

    const data = JSON.parse(localStorage.getItem("history") || "[]");
    data.unshift(entry);
    localStorage.setItem("history", JSON.stringify(data));

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

// ---------------- START ----------------
window.addEventListener("DOMContentLoaded", initApp);
