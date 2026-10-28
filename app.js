// Gallinero Climático — consume Open-Meteo (geocodificación + pronóstico). No requiere API key.
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = "https://api.open-meteo.com/v1/forecast";
const BASE_RATE = 0.8; // huevos/gallina/día en condiciones ideales (valor aproximado)

const $ = (id) => document.getElementById(id);
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let place = load("gallinero.place", { name: "Mérida, Yucatán, México", lat: 20.97, lon: -89.62 });
let eggLog = load("gallinero.eggs", {}); // { "2026-10-27": 5 }

/* ---------- Red y manejo de errores ---------- */
async function fetchJson(url) {
  if (!navigator.onLine) throw new Error("Sin conexión a internet. Revisa tu red e inténtalo de nuevo.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) throw new Error("Se alcanzó el límite de peticiones. Espera un minuto e inténtalo otra vez.");
    if (!res.ok) throw new Error(`El servicio de clima respondió con un error (${res.status}).`);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("El servicio tardó demasiado en responder. Inténtalo de nuevo.");
    if (e instanceof TypeError) throw new Error("No se pudo conectar con el servicio de clima.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function searchPlace(query) {
  const data = await fetchJson(`${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=es`);
  if (!data.results || data.results.length === 0) {
    throw new Error(`No encontramos "${query}". Prueba con otro nombre o agrega el estado.`);
  }
  const r = data.results[0];
  return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude };
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: 7,
    daily: "temperature_2m_max,temperature_2m_min,daylight_duration",
  });
  const data = await fetchJson(`${WX_URL}?${params}`);
  if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
    throw new Error("El servicio no devolvió datos de pronóstico para este lugar.");
  }
  return data.daily;
}

/* ---------- Lógica del gallinero ---------- */
function heatLevel(tmax) {
  if (tmax >= 35) return { cls: "danger", label: "Calor extremo", tip: "Da sombra, agua fresca y ventilación. Evita manejarlas al mediodía." };
  if (tmax >= 30) return { cls: "alert", label: "Calor", tip: "Agua fresca extra y sombra. La puesta puede bajar." };
  if (tmax <= 5) return { cls: "cold", label: "Frío", tip: "Protege del viento y revisa que el agua no se congele." };
  return { cls: "", label: "Buen clima", tip: "Temperatura cómoda para la puesta." };
}

function tempFactor(tmax) {
  if (tmax >= 35) return 0.7;
  if (tmax >= 30) return 0.85;
  if (tmax <= 5) return 0.8;
  return 1;
}

function lightFactor(hours) {
  if (hours >= 14) return 1;
  return Math.max(0.7, 0.7 + 0.3 * ((hours - 10) / 4)); // de 10 h (0.7) a 14 h (1.0)
}

function estimateEggs(hens, tmax, daylightHours) {
  return hens * BASE_RATE * tempFactor(tmax) * lightFactor(daylightHours);
}

/* ---------- Pronóstico en pantalla ---------- */
function setStatus(msg, type = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + type;
}

function renderForecast(daily, hens) {
  const box = $("forecast");
  box.replaceChildren();
  daily.time.forEach((date, i) => {
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    const light = daily.daylight_duration[i] / 3600;
    const lvl = heatLevel(tmax);
    const eggs = estimateEggs(hens, tmax, light);
    const extraLight = light < 14 ? Math.ceil((14 - light) * 10) / 10 : 0;

    const card = document.createElement("article");
    card.className = "day " + lvl.cls;
    const name = new Date(date + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
    const parts = [
      ["b", name],
      ["div", `${Math.round(tmax)}° / ${Math.round(tmin)}°`, "temp"],
      ["div", lvl.label, "lvl"],
      ["div", `☀ ${light.toFixed(1)} h de luz`],
      ["div", `≈ ${eggs.toFixed(1)} huevos`, "eggs"],
      ["p", extraLight > 0 ? `Agrega ${extraLight} h de luz artificial. ${lvl.tip}` : lvl.tip],
    ];
    parts.forEach(([tag, text, cls]) => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (cls) el.className = cls;
      card.appendChild(el);
    });
    box.appendChild(card);
    if (i === 0) $("eggToday").textContent = Math.round(eggs);
  });
}

async function refresh() {
  const hens = Number($("hens").value) || 1;
  $("place").textContent = place.name;
  setStatus("Consultando pronóstico…", "loading");
  try {
    const daily = await getForecast(place.lat, place.lon);
    renderForecast(daily, hens);
    setStatus("");
  } catch (e) {
    $("forecast").replaceChildren();
    $("eggToday").textContent = "–";
    setStatus(e.message, "error");
  }
}

$("configForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const query = $("city").value.trim();
  save("gallinero.hens", $("hens").value);
  if (query) {
    setStatus("Buscando ciudad…", "loading");
    try {
      place = await searchPlace(query);
      save("gallinero.place", place);
    } catch (e) {
      setStatus(e.message, "error");
      return;
    }
  }
  refresh();
});

/* ---------- Registro de huevos (localStorage) ---------- */
const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en hora local

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toLocaleDateString("en-CA"));
  }
  return out;
}

function renderLog() {
  const dates = Object.keys(eggLog).sort().reverse();
  const total = dates.reduce((s, d) => s + eggLog[d], 0);
  const week = lastDays(7);
  const weekSum = week.reduce((s, d) => s + (eggLog[d] || 0), 0);
  $("statTotal").textContent = total;
  $("statAvg").textContent = (weekSum / 7).toFixed(1);

  const max = Math.max(1, ...week.map((d) => eggLog[d] || 0));
  const chart = $("chart");
  chart.replaceChildren();
  week.forEach((d) => {
    const n = eggLog[d] || 0;
    const bar = document.createElement("div");
    bar.className = "bar";
    const label = document.createElement("span");
    label.textContent = n;
    const fill = document.createElement("i");
    fill.style.height = (n / max) * 85 + "%";
    const day = document.createElement("span");
    day.textContent = new Date(d + "T00:00:00").toLocaleDateString("es-MX", { weekday: "narrow" });
    bar.append(label, fill, day);
    chart.appendChild(bar);
  });

  const list = $("logList");
  list.replaceChildren();
  if (dates.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Aún no hay registros. Anota los huevos que recogiste hoy.";
    list.appendChild(li);
    return;
  }
  dates.forEach((d) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}: ${eggLog[d]} huevos`;
    const del = document.createElement("button");
    del.className = "link";
    del.textContent = "Eliminar";
    del.addEventListener("click", () => {
      delete eggLog[d];
      save("gallinero.eggs", eggLog);
      renderLog();
    });
    li.append(text, del);
    list.appendChild(li);
  });
}

$("logForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = $("logDate").value;
  const count = parseInt($("logCount").value, 10);
  if (!date || Number.isNaN(count) || count < 0) return;
  eggLog[date] = count; // un registro por día: guardar de nuevo reemplaza el valor
  save("gallinero.eggs", eggLog);
  $("logCount").value = "";
  renderLog();
});

/* ---------- Inicio ---------- */
window.addEventListener("offline", () => setStatus("Perdiste la conexión a internet.", "error"));
window.addEventListener("online", refresh);

$("city").value = place.name.split(",")[0];
$("hens").value = load("gallinero.hens", "6");
$("logDate").value = todayStr();
renderLog();
refresh();
