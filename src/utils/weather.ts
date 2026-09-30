/*
 * Current weather snapshot published by the `cron` worker that crawls
 * OpenWeatherMap every ten minutes and writes the result to object storage.
 *
 * Everything in the payload is treated as untrusted and possibly absent: a
 * failed crawl can leave the snapshot stale or partial, so every field is
 * normalised to `undefined` rather than assumed to be there.
 */

/** Public object URL the crawler writes to. */
export const WEATHER_ENDPOINT = "https://object.amia.work/weather.json";

/** The crawler is configured for coordinates in Hokkaido, so readings are shown in JST. */
const WEATHER_TIME_ZONE = "Asia/Tokyo";

/** Shown in place of a reading the snapshot does not carry. */
export const WEATHER_PLACEHOLDER = "—";

/** The icon codes OpenWeatherMap can return; only these are ever requested. */
const WEATHER_ICON_CODES = [
  "01d",
  "01n",
  "02d",
  "02n",
  "03d",
  "03n",
  "04d",
  "04n",
  "09d",
  "09n",
  "10d",
  "10n",
  "11d",
  "11n",
  "13d",
  "13n",
  "50d",
  "50n",
] as const;

export interface WeatherAlert {
  event?: string;
  start?: number;
  end?: number;
  description?: string;
}

export interface Weather {
  /** Observation time, as a Unix timestamp in seconds. */
  dt?: number;
  sunrise?: number;
  sunset?: number;
  /** All readings are metric: °C, hPa, metres, metres per second. */
  temp?: number;
  feelsLike?: number;
  pressure?: number;
  humidity?: number;
  dewPoint?: number;
  uvi?: number;
  clouds?: number;
  visibility?: number;
  windSpeed?: number;
  windDeg?: number;
  windGust?: number;
  rain?: number;
  snow?: number;
  description?: string;
  /** OpenWeatherMap icon code, one of `WEATHER_ICON_CODES`. */
  icon?: string;
  alerts: WeatherAlert[];
}

interface WeatherDetail {
  label: string;
  value: string;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const toNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const toText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
};

/* An alert the crawler could not describe is dropped rather than rendered blank. */
const toAlerts = (value: unknown): WeatherAlert[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const alert = toRecord(entry);
    if (!alert) return [];

    const normalised: WeatherAlert = {
      event: toText(alert.event),
      start: toNumber(alert.start),
      end: toNumber(alert.end),
      description: toText(alert.description),
    };

    return normalised.event === undefined &&
      normalised.description === undefined
      ? []
      : [normalised];
  });
};

/** Normalise a crawled snapshot, or `null` when the payload is not an object. */
export const parseWeather = (payload: unknown): Weather | null => {
  const record = toRecord(payload);
  if (!record) return null;

  const fromRecord = (key: string) => toNumber(record[key]);
  const conditions = Array.isArray(record.weather) ? record.weather : [];
  const condition = toRecord(conditions[0]);

  return {
    dt: fromRecord("dt"),
    sunrise: fromRecord("sunrise"),
    sunset: fromRecord("sunset"),
    temp: fromRecord("temp"),
    feelsLike: fromRecord("feels_like"),
    pressure: fromRecord("pressure"),
    humidity: fromRecord("humidity"),
    dewPoint: fromRecord("dew_point"),
    uvi: fromRecord("uvi"),
    clouds: fromRecord("clouds"),
    visibility: fromRecord("visibility"),
    windSpeed: fromRecord("wind_speed"),
    windDeg: fromRecord("wind_deg"),
    windGust: fromRecord("wind_gust"),
    rain: fromRecord("rain"),
    snow: fromRecord("snow"),
    description: toText(condition?.description),
    icon: toText(condition?.icon),
    alerts: toAlerts(record.alerts),
  };
};

/** Whether the snapshot carries anything worth rendering. */
export const hasWeather = (weather: Weather): boolean =>
  weather.temp !== undefined ||
  weather.description !== undefined ||
  weather.icon !== undefined;

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const formatTemperature = (celsius?: number): string | undefined =>
  celsius === undefined ? undefined : `${round(celsius, 1)}°C`;

const formatSpeed = (metresPerSecond?: number): string | undefined =>
  metresPerSecond === undefined
    ? undefined
    : `${round(metresPerSecond, 1)} m/s`;

const formatMillimetres = (millimetres?: number): string | undefined =>
  millimetres === undefined ? undefined : `${round(millimetres, 1)} mm`;

export const formatPressure = (hectopascals?: number): string | undefined =>
  hectopascals === undefined ? undefined : `${Math.round(hectopascals)} hPa`;

export const formatPercent = (percent?: number): string | undefined =>
  percent === undefined ? undefined : `${Math.round(percent)}%`;

export const formatVisibility = (metres?: number): string | undefined =>
  metres === undefined ? undefined : `${round(metres / 1000, 1)} km`;

const describeUvIndex = (index: number): string => {
  if (index >= 11) return "極端に強い";
  if (index >= 8) return "非常に強い";
  if (index >= 6) return "強い";
  if (index >= 3) return "中程度";
  return "弱い";
};

export const formatUvIndex = (index?: number): string | undefined =>
  index === undefined
    ? undefined
    : `${Math.round(index)} (${describeUvIndex(index)})`;

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export const formatWindDirection = (degrees?: number): string | undefined => {
  if (degrees === undefined) return undefined;

  const normalised = ((degrees % 360) + 360) % 360;
  const point = COMPASS_POINTS[Math.round(normalised / 22.5) % 16];

  return `${point} (${Math.round(normalised)}°)`;
};

export const formatWind = (
  speed?: number,
  degrees?: number,
): string | undefined => {
  const speedLabel = formatSpeed(speed);
  const directionLabel = formatWindDirection(degrees);

  if (!speedLabel) return directionLabel;
  return directionLabel ? `${speedLabel} ${directionLabel}` : speedLabel;
};

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: WEATHER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const formatTime = (unixSeconds?: number): string | undefined =>
  unixSeconds === undefined
    ? undefined
    : timeFormatter.format(new Date(unixSeconds * 1000));

export const toDateTime = (unixSeconds?: number): string | undefined =>
  unixSeconds === undefined
    ? undefined
    : new Date(unixSeconds * 1000).toISOString();

export const formatTimeRange = (
  start?: number,
  end?: number,
): string | undefined => {
  const from = formatTime(start);
  const to = formatTime(end);

  if (from && to) return `${from} – ${to}`;
  return from ?? to;
};

/** Every reading the snapshot carries, in the order they are shown on wide screens. */
export const buildDetails = (weather: Weather): WeatherDetail[] => {
  const details: WeatherDetail[] = [];

  const add = (label: string, value: string | undefined) => {
    if (value !== undefined) details.push({ label, value });
  };

  add("体感温度", formatTemperature(weather.feelsLike));
  add("湿度", formatPercent(weather.humidity));
  add("露点", formatTemperature(weather.dewPoint));
  add("気圧", formatPressure(weather.pressure));
  add("雲量", formatPercent(weather.clouds));
  add("視程", formatVisibility(weather.visibility));
  add("UV指数", formatUvIndex(weather.uvi));
  add("風", formatWind(weather.windSpeed, weather.windDeg));
  add("突風", formatSpeed(weather.windGust));
  add("日の出", formatTime(weather.sunrise));
  add("日の入り", formatTime(weather.sunset));
  add("降水量 (1h)", formatMillimetres(weather.rain));
  add("降雪量 (1h)", formatMillimetres(weather.snow));

  return details;
};

/** Path of the self-hosted icon for a condition, or `undefined` for an unknown code. */
export const weatherIconUrl = (icon?: string): string | undefined =>
  icon !== undefined && (WEATHER_ICON_CODES as readonly string[]).includes(icon)
    ? `/weather/${icon}.png`
    : undefined;
