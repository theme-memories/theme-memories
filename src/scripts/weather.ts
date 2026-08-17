import { weather as weatherConfig } from "../config";

const WEATHER_URL = weatherConfig.jsonUrl;

const root = document.querySelector<HTMLElement>("[data-weather]");
if (!root) throw new Error("weather widget root not found");

interface WeatherData {
  fetchedAt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  visibility: number;
  rain: number | null;
  snow: number | null;
  description: string;
  icon: string;
  alerts: { event: string; start: number; end: number }[];
}

const JST_TIMEZONE = "Asia/Tokyo";

function setText(selector: string, text: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.textContent = text;
}

function formatTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(unixSeconds * 1000));
}

function formatDateTime(unixSeconds: number): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSeconds * 1000));
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")}/${value("day")} ${value("hour")}:${value("minute")}`;
}

function formatVisibility(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1).replace(/\.0$/, "")} km`;
  }
  return `${meters} m`;
}

const WIND_DIRECTIONS = [
  "北",
  "北北東",
  "北東",
  "東北東",
  "東",
  "東南東",
  "南東",
  "南南東",
  "南",
  "南南西",
  "南西",
  "西南西",
  "西",
  "西北西",
  "北西",
  "北北西",
];

function windDirection(deg: number): string {
  return WIND_DIRECTIONS[Math.round((deg % 360) / 22.5) % 16];
}

function renderWeather(data: WeatherData): void {
  setText("[data-weather-min-temp]", `${Math.round(data.temp)}°C`);
  setText("[data-weather-min-desc]", data.description);
  setText("[data-weather-full-temp]", `${Math.round(data.temp)}°C`);
  setText("[data-weather-full-desc]", data.description);
  setText("[data-weather-feels-like]", `${data.feels_like.toFixed(1)}°C`);
  setText("[data-weather-humidity]", `${data.humidity}%`);
  setText("[data-weather-wind]", `${data.wind_speed.toFixed(1)} m/s`);
  setText("[data-weather-pressure]", `${data.pressure} hPa`);
  setText("[data-weather-clouds]", `${data.clouds}%`);
  setText("[data-weather-uvi]", data.uvi.toFixed(1));
  setText("[data-weather-visibility]", formatVisibility(data.visibility));
  setText("[data-weather-sunrise]", formatTime(data.sunrise));
  setText("[data-weather-sunset]", formatTime(data.sunset));
  setText("[data-weather-updated]", `${formatDateTime(data.fetchedAt)} 更新`);
  setText("[data-weather-dew-point]", `${data.dew_point.toFixed(1)}°C`);
  setText(
    "[data-weather-wind-deg]",
    `${windDirection(data.wind_deg)}風 (${Math.round(data.wind_deg)}°)`,
  );
  setText("[data-weather-wind-gust]", `${data.wind_gust.toFixed(1)} m/s`);
  setText("[data-weather-rain]", `${data.rain ?? 0} mm`);
  setText("[data-weather-snow]", `${data.snow ?? 0} mm`);

  const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
  const minIcon = document.querySelector<HTMLImageElement>(
    "[data-weather-min-icon]",
  );
  const fullIcon = document.querySelector<HTMLImageElement>(
    "[data-weather-full-icon]",
  );
  if (minIcon) minIcon.src = iconUrl;
  if (fullIcon) fullIcon.src = iconUrl;

  const alerts = document.querySelector<HTMLElement>("[data-weather-alerts]");
  if (alerts) {
    alerts.textContent = "";
    if (data.alerts.length > 0) {
      for (const alert of data.alerts) {
        const li = document.createElement("li");
        const time = document.createElement("span");
        time.className = "weather-alert-time";
        time.textContent = `${formatDateTime(alert.start)} – ${formatDateTime(alert.end)}`;
        li.appendChild(document.createTextNode(alert.event));
        li.appendChild(time);
        alerts.appendChild(li);
      }
      alerts.hidden = false;
    } else {
      alerts.hidden = true;
    }
  }
}

fetch(WEATHER_URL)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`weather fetch failed: ${response.status}`);
    }
    return response.json() as Promise<WeatherData>;
  })
  .then((data) => {
    renderWeather(data);
    root.classList.add("is-ready");
  })
  .catch((error) => {
    console.error("weather widget failed to load", error);
  });
