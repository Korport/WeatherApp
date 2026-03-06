// 1) Put your OpenWeather API key here
const OPENWEATHER_API_KEY = "efb9ccd5202df0001bfdf49fee997f2c";

// 2) DOM elements
const form = document.getElementById("searchForm");
const input = document.getElementById("cityInput");
const statusEl = document.getElementById("status");
const appHomeEl = document.getElementById("appHome");
const popularCityButtons = document.querySelectorAll(".popular-btn");
const popularSectionEl = document.querySelector(".popular");

const resultEl = document.getElementById("result");
const cityNameEl = document.getElementById("cityName");
const cityTimeEl = document.getElementById("cityTime");
const tempEl = document.getElementById("temp");
const descEl = document.getElementById("desc");
const weatherIconEl = document.getElementById("weatherIcon");
const feelsEl = document.getElementById("feels");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const pressureEl = document.getElementById("pressure");
const visibilityEl = document.getElementById("visibility");
const cloudsEl = document.getElementById("clouds");

const mapSectionEl = document.getElementById("mapSection");
const timelapseToggleEl = document.getElementById("timelapseToggle");
const timelapseLabelEl = document.getElementById("timelapseLabel");

const forecastSectionEl = document.getElementById("forecastSection");
const forecastContainerEl = document.getElementById("forecastContainer");

const commentEl = document.getElementById("weatherComment");

let weatherMap;
let cloudLayer;
let timelapseTimerId = null;
let timelapseFrames = [];
let timelapseIndex = 0;
let isTimelapsePlaying = true;
let latestRequestId = 0;
let cityTimeOffsetSeconds = null;
let cityTimeIntervalId = null;
document.body.dataset.weather = "cloudy";

const CITY_TIMEZONES = {
  "New York": "America/New_York",
  "Los Angeles": "America/Los_Angeles",
  Chicago: "America/Chicago",
  Miami: "America/New_York",
  Seattle: "America/Los_Angeles",
  Madrid: "Europe/Madrid",
  Sydney: "Australia/Sydney",
  London: "Europe/London",
  Tokyo: "Asia/Tokyo",
};

function setStatus(msg) {
  statusEl.textContent = msg;
}

function showResult(show) {
  resultEl.classList.toggle("hidden", !show);
}

function showMap(show) {
  mapSectionEl.classList.toggle("hidden", !show);
}

function showForecast(show) {
  forecastSectionEl.classList.toggle("hidden", !show);
}

function showComment(show) {
  commentEl.classList.toggle("hidden", !show);
}

function showPopular(show) {
  if (!popularSectionEl) return;
  popularSectionEl.classList.toggle("hidden", !show);
}

function resetToStartPage() {
  latestRequestId += 1;
  setStatus("");
  input.value = "";
  cityTimeOffsetSeconds = null;
  updateCityTimeDisplay();

  if (cityTimeIntervalId) {
    clearInterval(cityTimeIntervalId);
    cityTimeIntervalId = null;
  }

  stopCloudTimelapse();
  if (weatherMap) {
    weatherMap.remove();
    weatherMap = null;
    cloudLayer = null;
  }

  timelapseLabelEl.textContent = "";
  timelapseToggleEl.textContent = "Pause";
  timelapseToggleEl.disabled = false;
  forecastContainerEl.replaceChildren();
  showResult(false);
  showMap(false);
  showForecast(false);
  showComment(false);
  showPopular(true);
}

function formatTemp(t) {
  return `${Math.round(t)}\u00B0`;
}

function formatLocalTimeByOffset(offsetSeconds) {
  const cityDate = new Date(Date.now() + offsetSeconds * 1000);
  const weekday = cityDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const time = cityDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
  return `${weekday} ${time}`;
}

function updateCityTimeDisplay() {
  if (typeof cityTimeOffsetSeconds !== "number") {
    cityTimeEl.textContent = "";
    return;
  }
  cityTimeEl.textContent = `Local time: ${formatLocalTimeByOffset(cityTimeOffsetSeconds)}`;
}

function startCityTimeClock(offsetSeconds) {
  cityTimeOffsetSeconds = offsetSeconds;
  updateCityTimeDisplay();

  if (cityTimeIntervalId) clearInterval(cityTimeIntervalId);
  cityTimeIntervalId = setInterval(updateCityTimeDisplay, 30000);
}

function setupPopularButtonsWithTimes() {
  popularCityButtons.forEach((btn) => {
    const city = btn.dataset.city;
    if (!city) return;

    const cityLabel = document.createElement("span");
    cityLabel.className = "popular-city";
    cityLabel.textContent = city;

    const timeLabel = document.createElement("span");
    timeLabel.className = "popular-time";
    timeLabel.textContent = "--:--";

    btn.replaceChildren(cityLabel, timeLabel);
  });
}

function updatePopularButtonTimes() {
  const now = new Date();
  popularCityButtons.forEach((btn) => {
    const city = btn.dataset.city;
    const timezone = CITY_TIMEZONES[city];
    const timeEl = btn.querySelector(".popular-time");
    if (!timezone || !timeEl) return;

    timeEl.textContent = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
  });
}

function getWindDirection(deg) {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function getWeatherIconAndClass(desc, windSpeed) {
  const lower = desc.toLowerCase();
  let icon = "01d"; // default clear
  let animationClass = "sunny";

  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("shower")) {
    icon = "10d"; // rain
    animationClass = "rainy";
  } else if (lower.includes("snow")) {
    icon = "13d"; // snow
    animationClass = "snowy";
  } else if (lower.includes("thunderstorm")) {
    icon = "11d"; // thunderstorm
    animationClass = "rainy";
  } else if (lower.includes("cloud") || lower.includes("overcast")) {
    if (lower.includes("few") || lower.includes("scattered")) {
      icon = "02d"; // few clouds
    } else {
      icon = "04d"; // broken clouds
    }
    animationClass = "cloudy";
  } else if (windSpeed > 15) {
    icon = "50d"; // mist (representing wind)
    animationClass = "windy";
  } else if (lower.includes("clear") || lower.includes("sun")) {
    icon = "01d"; // clear sky
    animationClass = "sunny";
  }

  return { icon, animationClass };
}

function setWeatherBackground(weatherType) {
  document.body.dataset.weather = weatherType;
}

function formatVisibility(vis) {
  if (typeof vis !== "number") return "N/A";
  const miles = (vis / 1609.34).toFixed(1); // meters to miles
  return `${miles} mi`;
}

function generateWeatherComment(city, temp, desc, windSpeed) {
  const cityName = city.split(",")[0].trim();
  const lowerDesc = desc.toLowerCase();

  // City-specific comments
  const cityComments = {
    Seattle: {
      rain: ["Of course it's raining in Seattle. Again. Welcome to the Emerald City... of perpetual drizzle.", "Seattle weather: 9 months of winter, 3 months of bad skiing."],
      clear: ["Sunny in Seattle? Quick, check if hell froze over too!", "Seattle sunshine is like a unicorn - mythical and rarely seen."],
    },
    Phoenix: {
      hot: ["Phoenix in summer: Hotter than Satan's sauna. Stay inside or you'll melt.", "Welcome to Phoenix, where the sun doesn't set - it just beats you senseless."],
      clear: ["Phoenix: Where 'partly cloudy' means 'the sun is taking a coffee break'."],
    },
    "New York": {
      snow: ["NYC snow: Beautiful for 5 minutes, then it's just dirty slush everywhere.", "New York winter: When the city that never sleeps just wants a nap under a blanket of snow."],
      rain: ["NYC rain: Perfect excuse to stay inside and eat pizza."],
    },
    Miami: {
      hot: ["Miami heat: So hot, even the palm trees are sweating.", "Welcome to Miami, where the humidity hugs you like an unwanted relative."],
      hurricane: ["Miami hurricane season: When the weather tries to evict everyone."],
    },
    Chicago: {
      cold: ["Chicago winter: Windier than a politician's promises.", "Chicago: Where they measure winter in 'layers of clothing'."],
    },
  };

  // Weather-based comments
  const weatherComments = {
    hot: [
      `${cityName} is hotter than a jalapeno's armpit! Stay cool or you'll turn into a puddle.`,
      `Welcome to ${cityName}, where the sun is trying to give everyone a group hug... a very aggressive one.`,
      `${cityName} heat: So intense, even the ice cream is sweating.`,
    ],
    cold: [
      `Brrr! ${cityName} is colder than a polar bear's toenails. Bundle up or become a human popsicle!`,
      `${cityName} winter: When your breath freezes before it leaves your mouth.`,
      `Welcome to ${cityName}, where the temperature is so low, even the snowmen are shivering.`,
    ],
    rain: [
      `${cityName} is having a pity party with all this rain. Someone get it some tissues!`,
      `Rain in ${cityName}: Perfect weather for ducks, umbrellas, and indoor Netflix marathons.`,
      `${cityName} weather: When the sky cries more than a soap opera star.`,
    ],
    snow: [
      `${cityName} is buried under more snow than a penguin's bad decisions!`,
      `Snow in ${cityName}: Beautiful for about 5 minutes, then it's just cold and slippery.`,
      `${cityName} winter wonderland: Where every step sounds like you're walking on potato chips.`,
    ],
    clear: [
      `${cityName} has clearer skies than a politician's conscience. Enjoy the sunshine!`,
      `Perfect weather in ${cityName}! The kind of day that makes you want to skip work and go to the beach.`,
      `${cityName} sunshine: So bright, you might need sunglasses just to look at your phone.`,
    ],
    cloudy: [
      `${cityName} skies: Overcast with a chance of existential dread.`,
      `Cloudy in ${cityName}: When the sky looks like it's wearing a gray turtleneck.`,
      `${cityName} clouds: Thick enough to hide airplanes, thin enough to ruin your picnic.`,
    ],
    windy: [
      `${cityName} wind: Strong enough to rearrange your hairstyle... and your furniture.`,
      `Welcome to ${cityName}, where the wind is more aggressive than a caffeinated squirrel.`,
      `${cityName} breeze: So windy, even the trees are doing yoga poses.`,
    ],
  };

  // Check for city-specific comments first
  if (cityComments[cityName]) {
    if (lowerDesc.includes("rain") && cityComments[cityName].rain) {
      return cityComments[cityName].rain[Math.floor(Math.random() * cityComments[cityName].rain.length)];
    }
    if (lowerDesc.includes("clear") && cityComments[cityName].clear) {
      return cityComments[cityName].clear[Math.floor(Math.random() * cityComments[cityName].clear.length)];
    }
    if (temp > 85 && cityComments[cityName].hot) {
      return cityComments[cityName].hot[Math.floor(Math.random() * cityComments[cityName].hot.length)];
    }
  }

  // General weather comments
  if (temp > 85) {
    return weatherComments.hot[Math.floor(Math.random() * weatherComments.hot.length)];
  }
  if (temp < 32) {
    return weatherComments.cold[Math.floor(Math.random() * weatherComments.cold.length)];
  }
  if (lowerDesc.includes("rain") || lowerDesc.includes("drizzle") || lowerDesc.includes("shower")) {
    return weatherComments.rain[Math.floor(Math.random() * weatherComments.rain.length)];
  }
  if (lowerDesc.includes("snow")) {
    return weatherComments.snow[Math.floor(Math.random() * weatherComments.snow.length)];
  }
  if (lowerDesc.includes("clear")) {
    return weatherComments.clear[Math.floor(Math.random() * weatherComments.clear.length)];
  }
  if (lowerDesc.includes("cloud")) {
    return weatherComments.cloudy[Math.floor(Math.random() * weatherComments.cloudy.length)];
  }
  if (windSpeed > 15) {
    return weatherComments.windy[Math.floor(Math.random() * weatherComments.windy.length)];
  }

  // Default fallback
  return `${cityName} weather: Somewhere between 'meh' and 'make the best of it'.`;
}

function initMap(lat, lon, cityName) {
  // Remove existing map if any
  if (weatherMap) {
    weatherMap.remove();
  }

  // Create new map centered on city with appropriate zoom
  weatherMap = L.map("map").setView([lat, lon], 6);

  // Add OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap contributors",
  }).addTo(weatherMap);

  const cloudsPane = weatherMap.createPane("cloudsPane");
  cloudsPane.classList.add("clouds-pane");
  cloudsPane.style.zIndex = "450";

  // Start with current cloud layer immediately, then upgrade to timelapse.
  cloudLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`, {
    attribution: "OpenWeatherMap",
    opacity: 1,
    pane: "cloudsPane",
  }).addTo(weatherMap);

  // Add marker at city with popup
  L.marker([lat, lon]).addTo(weatherMap).bindPopup(`<b>${cityName}</b><br>Cloud cover map centered here`).openPopup();

  setupCloudTimelapse();
}

function stopCloudTimelapse() {
  if (timelapseTimerId) {
    clearInterval(timelapseTimerId);
    timelapseTimerId = null;
  }
}

function buildTimelapseFrames() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const startUnix = Math.floor(now.getTime() / 1000);

  // Current hour + next 6 hours.
  timelapseFrames = [];
  for (let i = 0; i <= 6; i++) {
    timelapseFrames.push(startUnix + i * 3600);
  }
  timelapseIndex = 0;
}

function updateTimelapseLabel(unixTs) {
  const local = new Date(unixTs * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  timelapseLabelEl.textContent = `Cloud forecast time: ${local}`;
}

function setCloudFrame(unixTs) {
  if (!cloudLayer) return;
  const frameUrl =
    `https://maps.openweathermap.org/maps/2.0/weather/1h/CL/{z}/{x}/{y}?` +
    `date=${unixTs}&appid=${OPENWEATHER_API_KEY}`;

  cloudLayer.setUrl(frameUrl);
  updateTimelapseLabel(unixTs);
}

function startCloudTimelapse() {
  stopCloudTimelapse();
  if (!timelapseFrames.length) return;

  isTimelapsePlaying = true;
  timelapseToggleEl.textContent = "Pause";

  timelapseTimerId = setInterval(() => {
    timelapseIndex = (timelapseIndex + 1) % timelapseFrames.length;
    setCloudFrame(timelapseFrames[timelapseIndex]);
  }, 1300);
}

function setupCloudTimelapse() {
  stopCloudTimelapse();
  buildTimelapseFrames();

  if (!cloudLayer) return;

  let didFallback = false;
  const fallbackToStaticLayer = () => {
    if (didFallback) return;
    didFallback = true;
    stopCloudTimelapse();
    timelapseLabelEl.textContent = "Cloud timelapse unavailable for this API key. Showing current clouds.";
    cloudLayer.setUrl(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`);
    timelapseToggleEl.disabled = true;
    timelapseToggleEl.textContent = "Paused";
  };

  cloudLayer.off("tileerror");
  cloudLayer.on("tileerror", fallbackToStaticLayer);

  timelapseToggleEl.disabled = false;
  timelapseIndex = 0;
  setCloudFrame(timelapseFrames[timelapseIndex]);
  startCloudTimelapse();
}

function renderForecast(days) {
  // Clear previous forecast
  forecastContainerEl.replaceChildren();

  days.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "forecast-item";

    const date = new Date(item.dt * 1000);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const titleEl = document.createElement("h4");
    titleEl.innerHTML = `${dayName}<br><small>${monthDay}</small>`;

    const iconEl = document.createElement("img");
    iconEl.src = `https://openweathermap.org/img/w/${item.weather[0].icon}.png`;
    iconEl.alt = item.weather[0].description;
    iconEl.className = "forecast-icon";

    const forecastDescEl = document.createElement("div");
    forecastDescEl.className = "forecast-desc";
    forecastDescEl.textContent = item.weather[0].description;

    const forecastTempEl = document.createElement("div");
    forecastTempEl.className = "forecast-temp";
    forecastTempEl.textContent = `H: ${Math.round(item.temp.max)}\u00B0  L: ${Math.round(item.temp.min)}\u00B0`;

    itemEl.append(titleEl, iconEl, forecastDescEl, forecastTempEl);
    forecastContainerEl.appendChild(itemEl);
  });
}

async function getWeatherByCity(city) {
  // units=imperial for Fahrenheit; use metric for Celsius
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?q=${encodeURIComponent(city)}` +
    `&appid=${OPENWEATHER_API_KEY}` +
    `&units=imperial`;

  const res = await fetch(url);

  // OpenWeather returns 404 with JSON for unknown cities
  const data = await res.json();

  if (!res.ok) {
    const message = data?.message || "Something went wrong.";
    throw new Error(message);
  }

  return data;
}

async function getDailyForecastByCoords(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&exclude=current,minutely,hourly,alerts` +
    `&appid=${OPENWEATHER_API_KEY}` +
    `&units=imperial`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Daily forecast fetch failed");
  }

  return data;
}

async function getForecastByCoords(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${OPENWEATHER_API_KEY}` +
    `&units=imperial`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Forecast fetch failed");
  }

  return data;
}

function fallbackDailyFromThreeHour(data) {
  const byDay = {};
  data.list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const key = date.toISOString().slice(0, 10);
    if (!byDay[key]) {
      byDay[key] = {
        dt: item.dt,
        temp: { min: item.main.temp, max: item.main.temp },
        weather: item.weather,
      };
    } else {
      byDay[key].temp.min = Math.min(byDay[key].temp.min, item.main.temp);
      byDay[key].temp.max = Math.max(byDay[key].temp.max, item.main.temp);
    }
  });

  // Next 8 days requested; 2.5 endpoint can usually provide only ~5 days.
  const daily = Object.values(byDay);
  if (daily.length >= 9) return daily.slice(1, 9);
  return daily.slice(0, 8);
}

function selectNextEightDays(daily) {
  if (daily.length >= 9) return daily.slice(1, 9);
  return daily.slice(0, 8);
}

function renderWeather(data, requestId) {
  const city = `${data.name}, ${data.sys.country}`;
  const temp = data.main.temp;
  const feels = data.main.feels_like;
  const humidity = data.main.humidity;
  const wind = data.wind.speed;
  const windDeg = data.wind.deg;
  const pressure = data.main.pressure;
  const visibility = data.visibility;
  const clouds = data.clouds.all;
  const desc = data.weather?.[0]?.description ?? "--";
  const lat = data.coord.lat;
  const lon = data.coord.lon;
  const timezoneOffset = data.timezone ?? 0;

  cityNameEl.textContent = city;
  startCityTimeClock(timezoneOffset);
  tempEl.textContent = formatTemp(temp);
  descEl.textContent = desc;

  // Set weather icon and animation
  const { icon, animationClass } = getWeatherIconAndClass(desc, wind);
  weatherIconEl.replaceChildren();
  const weatherIconImg = document.createElement("img");
  weatherIconImg.src = `https://openweathermap.org/img/w/${icon}.png`;
  weatherIconImg.alt = desc;
  weatherIconEl.appendChild(weatherIconImg);
  weatherIconEl.className = `weather-icon ${animationClass}`;
  setWeatherBackground(animationClass);

  feelsEl.textContent = formatTemp(feels);
  humidityEl.textContent = `${humidity}%`;
  const windDirection = typeof windDeg === "number" ? ` ${getWindDirection(windDeg)}` : "";
  windEl.textContent = `${Math.round(wind)} mph${windDirection}`;
  pressureEl.textContent = `${pressure} hPa`;
  visibilityEl.textContent = formatVisibility(visibility);
  cloudsEl.textContent = `${clouds}%`;

  // Generate snarky comment
  const comment = generateWeatherComment(city, temp, desc, wind);
  commentEl.textContent = comment;
  showComment(true);

  showResult(true);
  showMap(true);
  initMap(lat, lon, city.split(",")[0]);

  getDailyForecastByCoords(lat, lon)
    .then((forecastData) => {
      if (requestId !== latestRequestId) return;
      const next8Days = selectNextEightDays(forecastData.daily || []);
      renderForecast(next8Days);
      showForecast(true);
    })
    .catch(async (err) => {
      if (requestId !== latestRequestId) return;
      console.error("Daily forecast error:", err);
      try {
        const fallbackData = await getForecastByCoords(lat, lon);
        if (requestId !== latestRequestId) return;
        renderForecast(fallbackDailyFromThreeHour(fallbackData));
        showForecast(true);
      } catch (fallbackErr) {
        if (requestId !== latestRequestId) return;
        console.error("Forecast fallback error:", fallbackErr);
        showForecast(false);
      }
    });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const city = input.value.trim();
  if (!city) return;

  const requestId = ++latestRequestId;

  if (OPENWEATHER_API_KEY === "PASTE_YOUR_KEY_HERE") {
    setStatus("Add your OpenWeather API key in app.js first.");
    showResult(false);
    return;
  }

  setStatus("Loading...");
  showResult(false);
  showMap(false);
  showForecast(false);
  showComment(false);

  try {
    const data = await getWeatherByCity(city);
    if (requestId !== latestRequestId) return;
    renderWeather(data, requestId);
    setStatus("");
  } catch (err) {
    if (requestId !== latestRequestId) return;
    setStatus(`Couldn't find weather for "${city}". (${err.message})`);
    showResult(false);
    showMap(false);
    showForecast(false);
    showComment(false);
  }
});

popularCityButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const city = btn.dataset.city;
    if (!city) return;
    showPopular(false);
    input.value = city;
    form.requestSubmit();
  });
});

timelapseToggleEl.addEventListener("click", () => {
  if (!timelapseFrames.length) return;

  if (isTimelapsePlaying) {
    stopCloudTimelapse();
    isTimelapsePlaying = false;
    timelapseToggleEl.textContent = "Play";
    return;
  }

  startCloudTimelapse();
});

appHomeEl?.addEventListener("click", resetToStartPage);
appHomeEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    resetToStartPage();
  }
});

setupPopularButtonsWithTimes();
updatePopularButtonTimes();
setInterval(updatePopularButtonTimes, 60000);
