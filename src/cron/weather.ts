// Cron task: fetch current weather + alerts from OpenWeatherMap and
// store a sanitized snapshot to R2 (runs every 10 minutes).
//
// Flow: fetchCurrentWeather() + fetchWeatherAlerts() in parallel ->
// buildWeatherPayload() (whitelist fields, coerce types, sanitize icon)
// -> size guard -> write "weather.json" to the article bucket.
import { weather as weatherConfig } from "../config";
import { logEvent, logError } from "./shared";

const CURRENT_WEATHER_URL =
  "https://api.openweathermap.org/data/4.0/onecall/current";
const ALERTS_URL = "https://api.openweathermap.org/data/3.0/onecall";
const REQUEST_TIMEOUT_MS = 10_000;
// Hard cap on the stored snapshot. OpenWeatherMap is stable but a runaway response
// must never blow up the R2 object; we refuse to publish if it exceeds this.
const MAX_PAYLOAD_BYTES = 64 * 1024;
const WEATHER_OBJECT_KEY = "weather.json";
// Edge caching for weather.json: short max-age with stale-while-revalidate so the
// public site can read it cheaply between the 10-minute cron runs.
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600";

export interface WeatherSyncEnv {
  ARTICLE_BUCKET: R2Bucket;
  OPENWEATHERMAP_API_KEY: SecretsStoreSecret;
}

export interface WeatherSyncResult {
  ok: boolean;
  fetchedAt: number;
  alertsCount: number;
  objectKeys: string[];
}

interface WeatherCondition {
  description?: string;
  icon?: string;
}

interface CurrentWeather {
  sunrise?: number;
  sunset?: number;
  temp?: number;
  feels_like?: number;
  pressure?: number;
  humidity?: number;
  dew_point?: number;
  uvi?: number;
  clouds?: number;
  wind_speed?: number;
  wind_deg?: number;
  visibility?: number;
  wind_gust?: number;
  weather?: WeatherCondition[];
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
}

interface WeatherAlert {
  event?: string;
  start?: number;
  end?: number;
}

interface OneCallCurrentResponse {
  data?: CurrentWeather[];
}

interface OneCallAlertsResponse {
  alerts?: WeatherAlert[];
}

const CURRENT_WEATHER_FIELDS: Array<keyof CurrentWeather> = [
  "sunrise",
  "sunset",
  "temp",
  "feels_like",
  "pressure",
  "humidity",
  "dew_point",
  "uvi",
  "clouds",
  "wind_speed",
  "wind_deg",
];

const ALERT_FIELDS: Array<keyof WeatherAlert> = ["event", "start", "end"];

function pickFields<T extends object>(
  record: T,
  fields: ReadonlyArray<keyof T>,
): Partial<T> {
  const selected: Partial<T> = {};
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined) selected[field] = value;
  }
  return selected;
}

// Sanitizers: coerce loose API values into the stored shape. Missing or
// wrong-typed values degrade to null rather than poisoning the payload.
function toNumberOrNull(value: number | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function hourlyPrecipitationMm(
  precip: { "1h"?: number } | undefined,
): number | null {
  const amount = precip?.["1h"];
  return typeof amount === "number" ? amount : null;
}

function sanitizeIcon(icon: string | undefined): string {
  // Fall back to a clear-day icon if the API returns an unexpected code.
  return typeof icon === "string" && /^[0-9]{2}[dn]$/.test(icon) ? icon : "01d";
}

async function fetchOpenWeatherJson(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`OpenWeatherMap request redirected (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`OpenWeatherMap request failed (${response.status})`);
  }
  return response.json();
}

function buildQueryParams(apiKey: string): URLSearchParams {
  const { lat, lon } = weatherConfig;
  return new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: "metric",
    lang: "ja",
    appid: apiKey,
  });
}

async function fetchCurrentWeather(apiKey: string): Promise<CurrentWeather> {
  const queryParams = buildQueryParams(apiKey);
  const response = (await fetchOpenWeatherJson(
    `${CURRENT_WEATHER_URL}?${queryParams}`,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  )) as OneCallCurrentResponse;
  const currentWeather = Array.isArray(response.data)
    ? response.data[0]
    : undefined;
  if (!currentWeather) {
    throw new Error("weather-sync: v4 current response has no data");
  }
  return currentWeather;
}

async function fetchWeatherAlerts(apiKey: string): Promise<WeatherAlert[]> {
  const queryParams = buildQueryParams(apiKey);
  queryParams.set("exclude", "current,minutely,hourly,daily");
  try {
    const response = (await fetchOpenWeatherJson(
      `${ALERTS_URL}?${queryParams}`,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    )) as OneCallAlertsResponse;
    return response.alerts ?? [];
  } catch (error) {
    logError("weather_sync_alerts_failed", error);
    return [];
  }
}

function buildWeatherPayload(
  currentWeather: CurrentWeather,
  weatherAlerts: WeatherAlert[],
  fetchedAt: number,
) {
  const [primaryWeather] = currentWeather.weather ?? [];
  return {
    fetchedAt: fetchedAt,
    ...pickFields(currentWeather, CURRENT_WEATHER_FIELDS),
    visibility: toNumberOrNull(currentWeather.visibility),
    wind_gust: toNumberOrNull(currentWeather.wind_gust),
    rain: hourlyPrecipitationMm(currentWeather.rain),
    snow: hourlyPrecipitationMm(currentWeather.snow),
    ...(primaryWeather?.description
      ? { description: primaryWeather.description }
      : {}),
    icon: sanitizeIcon(primaryWeather?.icon),
    alerts: weatherAlerts.map((alert) => pickFields(alert, ALERT_FIELDS)),
  };
}

export async function syncWeather(
  env: WeatherSyncEnv,
): Promise<WeatherSyncResult> {
  const apiKey = await env.OPENWEATHERMAP_API_KEY.get();
  if (!apiKey) {
    throw new Error("weather-sync: API key is not configured");
  }

  // Both calls are independent, so run them concurrently.
  const [currentWeather, weatherAlerts] = await Promise.all([
    fetchCurrentWeather(apiKey),
    fetchWeatherAlerts(apiKey),
  ]);

  const fetchedAt = Math.floor(Date.now() / 1000);
  const weatherSnapshot = buildWeatherPayload(
    currentWeather,
    weatherAlerts,
    fetchedAt,
  );

  const payloadJson = JSON.stringify(weatherSnapshot);
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    throw new Error("weather-sync: payload too large");
  }

  await env.ARTICLE_BUCKET.put(WEATHER_OBJECT_KEY, payloadJson, {
    httpMetadata: {
      contentType: "application/json",
      cacheControl: CACHE_CONTROL,
    },
  });

  return {
    ok: true,
    fetchedAt: fetchedAt,
    alertsCount: weatherAlerts.length,
    objectKeys: [WEATHER_OBJECT_KEY],
  };
}

export async function runWeatherSync(env: WeatherSyncEnv): Promise<void> {
  try {
    const result = await syncWeather(env);
    logEvent("weather_sync_ok", result);
  } catch (error) {
    logError("weather_sync_failed", error);
  }
}
