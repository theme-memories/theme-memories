import { weather as weatherConfig } from "../config";

const CURRENT_URL = "https://api.openweathermap.org/data/4.0/onecall/current";
const ALERTS_URL = "https://api.openweathermap.org/data/3.0/onecall";
const TIMEOUT_MS = 10_000;

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

const CURRENT_KEYS = [
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
] as const;

const ALERT_KEYS = ["event", "start", "end"] as const;

function pick(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function precipitation1h(value: unknown): number | null {
  if (value && typeof value === "object" && "1h" in value) {
    const hourly = (value as Record<string, unknown>)["1h"];
    if (typeof hourly === "number") return hourly;
  }
  return null;
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
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
  return (await response.json()) as Record<string, unknown>;
}

export async function syncWeather(
  env: WeatherSyncEnv,
): Promise<WeatherSyncResult> {
  const apiKey = await env.OPENWEATHERMAP_API_KEY.get();
  if (!apiKey) throw new Error("weather-sync: API key is not configured");
  const { lat, lon } = weatherConfig;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const baseParams = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: "metric",
    lang: "ja",
    appid: apiKey,
  });

  const currentResponse = await fetchJson(
    `${CURRENT_URL}?${baseParams}`,
    signal,
  );
  const currentData = currentResponse["data"];
  const current = Array.isArray(currentData) ? currentData[0] : undefined;
  if (!current) {
    throw new Error("weather-sync: v4 current response has no data");
  }

  let alerts: Record<string, unknown>[] = [];
  try {
    const alertsResponse = await fetchJson(
      `${ALERTS_URL}?${baseParams}&exclude=current,minutely,hourly,daily`,
      signal,
    );
    const alertsData = alertsResponse["alerts"];
    if (Array.isArray(alertsData)) {
      alerts = alertsData.map((alert) =>
        pick(alert as Record<string, unknown>, ALERT_KEYS),
      );
    }
  } catch (error) {
    console.error(
      "weather-sync: alerts fetch failed, continuing without alerts",
      error instanceof Error ? error.name : "UnknownError",
    );
  }

  const record = current as Record<string, unknown>;
  const weather = Array.isArray(record["weather"])
    ? record["weather"][0]
    : undefined;
  const weatherRecord = weather as Record<string, unknown> | undefined;

  const fetchedAt = Math.floor(Date.now() / 1000);
  const payload = {
    fetchedAt,
    ...pick(record, CURRENT_KEYS),
    visibility: numberOrNull(record["visibility"]),
    wind_gust: numberOrNull(record["wind_gust"]),
    rain: precipitation1h(record["rain"]),
    snow: precipitation1h(record["snow"]),
    ...(weatherRecord ? pick(weatherRecord, ["description", "icon"]) : {}),
    alerts,
  };

  const body = JSON.stringify(payload);
  const httpMetadata = { contentType: "application/json" };
  const canonicalKey = "weather.json";

  await env.ARTICLE_BUCKET.put(canonicalKey, body, { httpMetadata });

  return {
    ok: true,
    fetchedAt,
    alertsCount: alerts.length,
    keys: [canonicalKey],
  };
}
