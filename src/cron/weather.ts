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
const MAX_PAYLOAD_BYTES = 64 * 1024;
const WEATHER_OBJECT_KEY = "weather.json";
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600";

export interface WeatherSyncEnv {
  ARTICLE_BUCKET: R2Bucket;
  OPENWEATHERMAP_API_KEY: SecretsStoreSecret;
}

export interface WeatherSyncResult {
  ok: boolean;
  fetchedAt: number;
  alertsCount: number;
  keys: string[];
}

interface WeatherEntry {
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
  weather?: WeatherEntry[];
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
function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function hourlyPrecipMm(precip: { "1h"?: number } | undefined): number | null {
  const amount = precip?.["1h"];
  return typeof amount === "number" ? amount : null;
}

function sanitizeIcon(icon: string | undefined): string {
  // Fall back to a clear-day icon if the API returns an unexpected code.
  return typeof icon === "string" && /^[0-9]{2}[dn]$/.test(icon) ? icon : "01d";
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
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

function buildQueryParams(openWeatherApiKey: string): URLSearchParams {
  const { lat, lon } = weatherConfig;
  return new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: "metric",
    lang: "ja",
    appid: openWeatherApiKey,
  });
}

async function fetchCurrentWeather(
  openWeatherApiKey: string,
): Promise<CurrentWeather> {
  const queryParams = buildQueryParams(openWeatherApiKey);
  const response = (await fetchJson(
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

async function fetchWeatherAlerts(
  openWeatherApiKey: string,
): Promise<WeatherAlert[]> {
  const queryParams = buildQueryParams(openWeatherApiKey);
  queryParams.set("exclude", "current,minutely,hourly,daily");
  try {
    const response = (await fetchJson(
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
  syncedAt: number,
) {
  const [primaryWeather] = currentWeather.weather ?? [];
  return {
    fetchedAt: syncedAt,
    ...pickFields(currentWeather, CURRENT_WEATHER_FIELDS),
    visibility: numberOrNull(currentWeather.visibility),
    wind_gust: numberOrNull(currentWeather.wind_gust),
    rain: hourlyPrecipMm(currentWeather.rain),
    snow: hourlyPrecipMm(currentWeather.snow),
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
  const openWeatherApiKey = await env.OPENWEATHERMAP_API_KEY.get();
  if (!openWeatherApiKey) {
    throw new Error("weather-sync: API key is not configured");
  }

  // Both calls are independent, so run them concurrently.
  const [currentWeather, weatherAlerts] = await Promise.all([
    fetchCurrentWeather(openWeatherApiKey),
    fetchWeatherAlerts(openWeatherApiKey),
  ]);

  const syncedAt = Math.floor(Date.now() / 1000);
  const weatherPayload = buildWeatherPayload(
    currentWeather,
    weatherAlerts,
    syncedAt,
  );

  const payloadJson = JSON.stringify(weatherPayload);
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
    fetchedAt: syncedAt,
    alertsCount: weatherAlerts.length,
    keys: [WEATHER_OBJECT_KEY],
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
