const ddlUnits = document.querySelector("#ddlUnits");
const txtSearch = document.querySelector("#txtSearch");
const dvCityCountry = document.querySelector("#dvCityCountry");
const dvCurrDate = document.querySelector("#dvCurrDate");
const dvCurrTemp = document.querySelector("#dvCurrTemp");
const pFeelsLike = document.querySelector("#pFeelsLike");
const pHumidity = document.querySelector("#pHumidity");
const pWind = document.querySelector("#pWind");
const pPrecipitation = document.querySelector("#pPrecipitation");

let cityName, countryName, weatherData;
// FIX: track last-used lat/lon so the units dropdown can re-fetch without a city search
let lastLat, lastLon;


async function getGeoData() {
  const search = txtSearch.value.trim();

  // FIX: guard against empty search box (was crashing on page load)
  if (!search) return;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=jsonv2&addressdetails=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Response status: ${response.status}`);

    const result = await response.json();
    if (!result.length) return;

    const lat = result[0].lat;
    const lon = result[0].lon;

    loadLocationData(result);
    getWeatherData(lat, lon);
  } catch (error) {
    console.error(error.message);
  }
}

function loadLocationData(locationData) {
  const location = locationData[0].address;
  cityName = location.city || location.town || location.village || location.county || "";
  countryName = location.country_code.toUpperCase();

  const dateOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "long",
  };
  const currDate = new Intl.DateTimeFormat("en-US", dateOptions).format(new Date());

  dvCityCountry.textContent = `${cityName}, ${countryName}`;
  dvCurrDate.textContent = currDate;

  // حفظ آخر مدينة في localStorage
  localStorage.setItem("lastCity", JSON.stringify({
    name: locationData[0].display_name.split(",")[0],
    lat: locationData[0].lat,
    lon: locationData[0].lon,
    address: locationData[0].address,
  }));
}

async function getWeatherData(lat, lon) {
  // FIX: save for unit-toggle re-fetches
  lastLat = lat;
  lastLon = lon;

  let tempUnit = "celsius";
  let windUnit = "kmh";
  let precipUnit = "mm";

  if (ddlUnits.value === "F") {
    tempUnit = "fahrenheit";
    windUnit = "mph";
    precipUnit = "inch";
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m&wind_speed_unit=${windUnit}&temperature_unit=${tempUnit}&precipitation_unit=${precipUnit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Response status: ${response.status}`);

    weatherData = await response.json();

    loadCurrentWeather();
    loadHourlyForecast();
    loadDailyForecast();
  } catch (error) {
    console.error(error.message);
  }
}

function loadCurrentWeather() {
  dvCurrTemp.textContent = Math.round(weatherData.current.temperature_2m);
  pFeelsLike.textContent = Math.round(weatherData.current.apparent_temperature);
  pHumidity.textContent = weatherData.current.relative_humidity_2m;
  pWind.textContent = `${weatherData.current.wind_speed_10m} ${weatherData.current_units.wind_speed_10m.replace("mp/h", "mph")}`;
  pPrecipitation.textContent = `${weatherData.current.precipitation} ${weatherData.current_units.precipitation.replace("inch", "in")}`;
}

function loadHourlyForecast() {
  const hourly = weatherData.hourly;
  const todayStr = weatherData.current.time.slice(0, 10); // "2025-08-05"
  const tempUnit = weatherData.current_units.temperature_2m; // "°C" or "°F"

  const dvHourly = document.querySelector("#dvHourlyForecast");
  dvHourly.innerHTML = "";

  // فلتر ساعات اليوم الحالي كل ساعتين → 12 خانة
  hourly.time.forEach((timeStr, i) => {
    if (!timeStr.startsWith(todayStr)) return;

    const hour = new Date(timeStr).getHours();
    if (hour % 2 !== 0) return; // كل ساعتين فقط (0, 2, 4, ... 22)
    const label = hour === 0 ? "12 AM"
      : hour < 12 ? `${hour} AM`
      : hour === 12 ? "12 PM"
      : `${hour - 12} PM`;

    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weather_code[i];
    const iconName = getWeatherCodeName(code);

    const card = document.createElement("div");
    card.className = "hourly__card";
    card.innerHTML = `
      <p class="hourly__hour">${label}</p>
      <img class="hourly__icon" src="/assets/images/icon-${iconName}.webp" alt="${iconName}" width="320" height="320">
      <p class="hourly__temp">${temp}${tempUnit}</p>
    `;
    dvHourly.appendChild(card);
  });
}

function loadDailyForecast() {
  const daily = weatherData.daily;

  for (let i = 0; i < 7; i++) {
    const date = new Date(daily.time[i]);
    const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
    const dvForecastDay = document.querySelector(`#dvForecastDay${i + 1}`);
    const weatherCodeName = getWeatherCodeName(daily.weather_code[i]);
    const dailyHigh = Math.round(daily.temperature_2m_max[i]) + "°";
    const dailyLow = Math.round(daily.temperature_2m_min[i]) + "°";

    while (dvForecastDay.firstChild) {
      dvForecastDay.removeChild(dvForecastDay.firstChild);
    }

    addDailyElement("p", "daily__day-title", dayOfWeek, "", dvForecastDay, "afterbegin");
    addDailyElement("img", "daily__day-icon", "", weatherCodeName, dvForecastDay, "beforeend");
    addDailyElement("div", "daily__day-temps", "", "", dvForecastDay, "beforeend");

    const dvDailyTemps = document.querySelector(`#dvForecastDay${i + 1} .daily__day-temps`);
    addDailyElement("p", "daily__day-high", dailyHigh, "", dvDailyTemps, "afterbegin");
    addDailyElement("p", "daily__day-low", dailyLow, "", dvDailyTemps, "beforeend");
  }
}

function addDailyElement(tag, className, content, weatherCodeName, parentElement, position) {
  const newElement = document.createElement(tag);
  newElement.setAttribute("class", className);
  if (content !== "") {
    newElement.appendChild(document.createTextNode(content));
  }
  if (tag === "img") {
    newElement.setAttribute("src", `/assets/images/icon-${weatherCodeName}.webp`);
    newElement.setAttribute("alt", weatherCodeName);
    newElement.setAttribute("width", "320");
    newElement.setAttribute("height", "320");
  }
  parentElement.insertAdjacentElement(position, newElement);
}

function getWeatherCodeName(code) {
  const weatherCodes = {
    0: "sunny",
    1: "partly-cloudy",
    2: "partly-cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "drizzle",
    57: "drizzle",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    80: "rain",
    81: "rain",
    82: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    85: "snow",
    86: "snow",
    95: "storm",
    96: "storm",
    99: "storm",
  };
  return weatherCodes[code];
}

// ===== KEYBOARD NAVIGATION (Enter + Arrows) =====
// Single listener handles both search and autocomplete navigation
txtSearch.addEventListener("keydown", (e) => {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
  } else if (e.key === "Enter") {
    if (selectedIndex >= 0 && items.length) {
      // User navigated to a suggestion with arrows → select it
      selectSuggestion(selectedIndex);
    } else {
      // No suggestion highlighted → run a normal text search
      closeAutocomplete();
      getGeoData();
    }
  }
});

// ===== DARK / LIGHT MODE =====
const btnTheme = document.querySelector("#btnTheme");

btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
});

if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
}

// ===== AUTOCOMPLETE =====
const autocompleteList = document.querySelector("#autocompleteList");
let autocompleteTimeout;
let selectedIndex = -1;
let suggestions = [];

txtSearch.addEventListener("input", () => {
  clearTimeout(autocompleteTimeout);
  const query = txtSearch.value.trim();

  if (query.length < 2) {
    closeAutocomplete();
    return;
  }

  autocompleteTimeout = setTimeout(() => fetchSuggestions(query), 400);
});

async function fetchSuggestions(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5`;
    const res = await fetch(url);
    suggestions = await res.json();

    if (suggestions.length === 0) {
      closeAutocomplete();
      return;
    }

    autocompleteList.innerHTML = "";
    selectedIndex = -1;

    suggestions.forEach((place, i) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.textContent = place.display_name;
      item.addEventListener("click", () => selectSuggestion(i));
      autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = "block";
  } catch (err) {
    console.error("Autocomplete error:", err);
  }
}

function selectSuggestion(index) {
  const place = suggestions[index];
  txtSearch.value = place.display_name.split(",")[0];
  closeAutocomplete();
  loadLocationData([place]);
  getWeatherData(place.lat, place.lon);
}

function closeAutocomplete() {
  autocompleteList.style.display = "none";
  autocompleteList.innerHTML = "";
  selectedIndex = -1;
}



// Close suggestions on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrapper")) closeAutocomplete();
});

// ===== UNIT TOGGLE =====
// FIX: re-fetch using saved coords instead of calling getGeoData()
// (getGeoData re-runs a city search which is unnecessary and re-queries Nominatim)
ddlUnits.addEventListener("change", () => {
  if (lastLat && lastLon) {
    getWeatherData(lastLat, lastLon);
  }
});

// ===== استعادة آخر مدينة عند فتح الصفحة =====
const savedCity = localStorage.getItem("lastCity");
if (savedCity) {
  try {
    const city = JSON.parse(savedCity);
    txtSearch.value = city.name;
    loadLocationData([{ display_name: city.name, lat: city.lat, lon: city.lon, address: city.address }]);
    getWeatherData(city.lat, city.lon);
  } catch (e) {
    localStorage.removeItem("lastCity");
  }
}