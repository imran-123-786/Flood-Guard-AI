// ----------------------------
//  🔥 Flood Guard App.js
// ----------------------------

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
    checkLoginSession();

    const routeBtn = document.getElementById("find-route");
    if (routeBtn) routeBtn.addEventListener("click", findSafeRoute);

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;

                document.getElementById("user-location").textContent =
                    `${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;

                initMap();
                fetchWeather();
                fetchShelters();
                monitorBattery();
            },
            () => fallbackInit()
        );
    } else fallbackInit();

    // Network awareness
    window.addEventListener("offline", () => addHistory("system", "🌐 Offline mode activated"));
    window.addEventListener("online", () => addHistory("system", "🌐 Online - live data restored"));
}

function fallbackInit() {
    userLat = 20.5937;
    userLon = 78.9629;
    document.getElementById("user-location").textContent = "GPS blocked, using India default";
    initMap();
    fetchWeather();
    fetchShelters();
    monitorBattery();
}


// ---------------- MAP ----------------
function initMap() {
    const mapDiv = document.getElementById("map");
    if (!mapDiv || typeof L === "undefined") return;

    if (map) {
        map.setView([userLat, userLon], 12);
        return;
    }

    map = L.map("map").setView([userLat, userLon], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    L.marker([userLat, userLon]).addTo(map).bindPopup("📍 You are here").openPopup();
}
function changeLanguage(lang){
    localStorage.setItem("fg_language", lang);
    applyLanguage();
}

function applyLanguage(){
    const lang = localStorage.getItem("fg_language") || "en";
    const text = translations[lang];

    document.querySelector(".app-title").innerText = text.app_title;

    // Update navbar labels
    document.querySelectorAll(".nav-menu button").forEach(btn => {
        const key = btn.getAttribute("onclick").replace("showSection('","").replace("')","");
        if(text[key]) btn.innerText = text[key];
    });

    // Update dashboard elements
    document.getElementById("live-dashboard-title")?.innerText = text.live_dashboard;
    document.getElementById("location-label")?.innerText = text.location;
    document.getElementById("flood-risk-label")?.innerText = text.flood_risk;

    // Update instructions
    const infoList = document.getElementById("info-list");
    if(infoList){
        infoList.innerHTML = `
            <li>✔ ${text.instruction1}</li>
            <li>✔ ${text.instruction2}</li>
            <li>✔ ${text.instruction3}</li>
            <li>✔ ${text.instruction4}</li>
        `;
    }
}

// Load language on start
window.onload = () => {
    applyLanguage();
};


// ---------------- WEATHER ----------------
async function fetchWeather() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/weather?lat=${userLat}&lon=${userLon}`);
        const data = await res.json();
        latestWeather = data;

        document.getElementById("temp").textContent = `${data.temperature ?? "--"}°C`;
        document.getElementById("rain").textContent = `${data.rainfall ?? 0} mm`;
        document.getElementById("humidity").textContent = `${data.humidity ?? "--"}%`;

        updateRiskFromWeather(data);

        addHistory("weather", `Weather updated: ${data.temperature}°C`);
    } catch {
        addHistory("weather", "⚠ Failed to update weather");
    }
}
function updateAlertBanner(risk){
    const banner = document.getElementById("alert-banner");
    const text = document.getElementById("alert-text");

    if(risk < 30){
        banner.className = "alert-banner safe";
        text.innerText = "No immediate threat. Stay informed.";
    }
    else if(risk < 60){
        banner.className = "alert-banner warning";
        text.innerText = "Moderate risk. Avoid travel near rivers.";
    }
    else {
        banner.className = "alert-banner high";
        text.innerText = "HIGH RISK. Move to higher ground immediately!";
    }
}

function updateRiskFromWeather(data) {
    const rain = data.rainfall || 0;
    const hum = data.humidity || 0;

    let level = "Low", color = "green";
    if (rain > 80 || hum > 90) { level = "High"; color = "red"; }
    else if (rain > 40 || hum > 80) { level = "Moderate"; color = "orange"; }

    document.getElementById("risk-text").textContent = level;
    document.getElementById("risk-color").style.background = color;
}


// ---------------- BATTERY ----------------
function monitorBattery() {
    if (!navigator.getBattery) return;

    navigator.getBattery().then((battery) => {
        function update() {
            const level = Math.round(battery.level * 100);
            document.getElementById("battery-status").textContent = `${level}%`;

            if (level <= 20) addHistory("system", "⚠ Battery low, enabling emergency power mode");
        }

        battery.addEventListener("levelchange", update);
        update();
    });
}


// ---------------- SHELTERS ----------------
async function fetchShelters() {
    const res = await fetch(`${BACKEND_URL}/api/shelters`);
    const data = await res.json();

    const list = document.getElementById("shelter-list");
    list.innerHTML = "";

    (data.shelters || []).forEach((s) => {
        list.innerHTML += `<div class="contact-list"><strong>${s.name}</strong><br>${s.distance}</div>`;
    });
}


// ---------------- AI PREDICTION ----------------
async function runPrediction() {
    document.getElementById("predicted-level").textContent = "Processing...";

    const payload = {
        rainfall_mm_24h: latestWeather?.rainfall || 0,
        temperature_c: latestWeather?.temperature || 0,
        humidity: latestWeather?.humidity || 0,
    };

    try {
        const res = await fetch(`${BACKEND_URL}/api/predict-risk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        const label = data.risk_label || "Unknown";

        document.getElementById("predicted-level").textContent = `${label} (${data.confidence}%)`;
        addHistory("ai", `AI predicted: ${label}`);
    } catch {
        document.getElementById("predicted-level").textContent = "Error";
    }
}
window.runPrediction = runPrediction;


// ---------------- ROUTE ----------------
function findSafeRoute() {
    const mapsUrl = `https://www.google.com/maps/search/high+ground+near+me/@${userLat},${userLon},14z`;
    document.getElementById("route-result").innerHTML =
        `Move to higher ground.<br><a style="color:#fff" href="${mapsUrl}" target="_blank">Open Map</a>`;

    addHistory("route", "User requested safe route");
}


// ---------------- REPORT ----------------
function submitReport() {
    const text = document.getElementById("report-text").value.trim();
    if (!text) return alert("Please enter a report.");

    addHistory("report", `📝 ${text}`);
    document.getElementById("report-text").value = "";
    alert("Report saved.");
}
window.submitReport = submitReport;


// ---------------- SOS ----------------
function triggerSOS() {
    const url = `https://www.google.com/maps?q=${userLat},${userLon}`;
    const msg = `🚨 SOS FLOOD EMERGENCY 🚨\n📍 Location: ${url}\nPlease send help!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

    new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg").play().catch(()=>{});
    addHistory("sos", "SOS triggered");
}
window.triggerSOS = triggerSOS;


// ---------------- COMMUNITY ----------------
function loadVolunteers() {
    const list = document.getElementById("volunteer-list");
    const data = JSON.parse(localStorage.getItem("volunteers") || "[]");

    if (!data.length) return list.textContent = "No volunteers yet.";

    list.innerHTML = data.map(v =>
        `<div class='contact-list'><strong>${v.name}</strong> (${v.area})<br>📞 ${v.phone}</div>`
    ).join("");
}

function addVolunteer() {
    const name = prompt("Name:"), area = prompt("Area:"), phone = prompt("Phone:");
    if (!name || !area || !phone) return;

    const data = JSON.parse(localStorage.getItem("volunteers") || "[]");
    data.push({ name, area, phone });
    localStorage.setItem("volunteers", JSON.stringify(data));
    loadVolunteers();
    alert("Volunteer added ❤️");
}
window.addVolunteer = addVolunteer;


// ---------------- HISTORY ----------------
function addHistory(type, msg) {
    const now = new Date().toLocaleString();
    const entry = { time: now, type, message: msg };

    const data = JSON.parse(localStorage.getItem("history") || "[]");
    data.unshift(entry);
    localStorage.setItem("history", JSON.stringify(data));

    renderHistory();
}

function renderHistory() {
    const box = document.getElementById("history-data");
    const data = JSON.parse(localStorage.getItem("history") || "[]");

    if (!data.length) return box.textContent = "No history yet.";

    box.innerHTML = data.map(
        e => `<div class='contact-list'><strong>[${e.type}] ${e.time}</strong><br>${e.message}</div>`
    ).join("");
}


// ------------------------------------
//  💙 ACCOUNT SYSTEM (Merged & Final)
// ------------------------------------

// Email login system (local mock)
function emailLogin() {
    const email = document.getElementById("email-input").value;
    const pass = document.getElementById("email-pass").value;

    if (!email || !pass) return alert("Enter Email & Password");

    localStorage.setItem("floodguard_user", email);
    updateLoginUI(email);
}
window.emailLogin = emailLogin;

// OTP System (Mock mode)
function sendOTP() {
    let phone = document.getElementById("phone-input").value.trim();
    if (!phone) return alert("Enter phone number");

    alert("📩 OTP sent (Demo OTP: 1234)");

    document.getElementById("otp-input").style.display="block";
    document.getElementById("verify-otp-btn").style.display="block";

    localStorage.setItem("pending_otp_number", phone);
}
window.sendOTP = sendOTP;

function verifyOTP() {
    const otp = document.getElementById("otp-input").value.trim();

    if (otp === "1234") {
        const phone = localStorage.getItem("pending_otp_number");
        localStorage.setItem("floodguard_user", phone);
        updateLoginUI(phone);
        alert("✔ Login Successful");
    } else {
        alert("❌ Wrong OTP");
    }
}
window.verifyOTP = verifyOTP;


// Session Checker
function checkLoginSession() {
    const user = localStorage.getItem("floodguard_user");
    if (user) updateLoginUI(user);
}


// Update UI
function updateLoginUI(user) {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("profile-section").style.display = "block";

    document.getElementById("logged-user-contact").textContent = user;

    let savedPic = localStorage.getItem("profilePic");
    if (savedPic) document.getElementById("profile-img").src = savedPic;
}


// Logout
function logout() {
    localStorage.removeItem("floodguard_user");
    location.reload();
}
window.logout = logout;


// Upload Profile Image
function changeProfile() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    
    picker.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            localStorage.setItem("profilePic", reader.result);
            document.getElementById("profile-img").src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    picker.click();
}
window.changeProfile = changeProfile;


// Feedback
function submitFeedback() {
    const text = document.getElementById("feedback-text").value.trim();
    if (!text) return alert("Write feedback first");

    addHistory("feedback", text);
    alert("Thank you ❤️ Feedback saved.");
}
window.submitFeedback = submitFeedback;


// SHARE APP
function shareApp() {
    const msg = "🌊 Flood Guard – Stay safe during floods.\n🚨 Emergency alerts, safe routes, shelters & more.\nDownload soon!";
    
    if (navigator.share) {
        navigator.share({ text: msg });
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
}
window.shareApp = shareApp;


// Theme toggle
function toggleTheme() {
    document.body.classList.toggle("dark-mode");
}
window.toggleTheme = toggleTheme;


// ---------------- START APP ----------------
window.addEventListener("DOMContentLoaded", initApp);
