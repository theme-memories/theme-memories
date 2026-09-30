import { describe, expect, it } from "vitest";
import {
  buildDetails,
  formatPercent,
  formatPressure,
  formatTemperature,
  formatTime,
  formatTimeRange,
  formatUvIndex,
  formatVisibility,
  formatWind,
  formatWindDirection,
  hasWeather,
  parseWeather,
  toDateTime,
  weatherIconUrl,
  type Weather,
} from "../src/utils/weather";

/** The payload the crawler wrote at the time this snapshot was taken. */
const snapshot = {
  dt: 1789475291,
  sunrise: 1789415790,
  sunset: 1789460998,
  temp: 15.68,
  feels_like: 15.34,
  pressure: 1016,
  humidity: 78,
  dew_point: 11.86,
  uvi: 0,
  clouds: 100,
  visibility: 10000,
  wind_speed: 6.38,
  wind_deg: 91,
  wind_gust: 9.05,
  weather: [{ description: "厚い雲", icon: "04n" }],
  alerts: [],
};

describe("parseWeather", () => {
  it("normalises a full snapshot", () => {
    expect(parseWeather(snapshot)).toEqual({
      dt: 1789475291,
      sunrise: 1789415790,
      sunset: 1789460998,
      temp: 15.68,
      feelsLike: 15.34,
      pressure: 1016,
      humidity: 78,
      dewPoint: 11.86,
      uvi: 0,
      clouds: 100,
      visibility: 10000,
      windSpeed: 6.38,
      windDeg: 91,
      windGust: 9.05,
      rain: undefined,
      snow: undefined,
      description: "厚い雲",
      icon: "04n",
      alerts: [],
    });
  });

  it("rejects a payload that is not an object", () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather(undefined)).toBeNull();
    expect(parseWeather("<html>")).toBeNull();
    expect(parseWeather([])).toBeNull();
  });

  it("treats fields the snapshot omits as absent", () => {
    const weather = parseWeather({ temp: 15.5, weather: [] });

    expect(weather?.temp).toBe(15.5);
    expect(weather?.sunrise).toBeUndefined();
    expect(weather?.sunset).toBeUndefined();
    expect(weather?.visibility).toBeUndefined();
    expect(weather?.windGust).toBeUndefined();
    expect(weather?.description).toBeUndefined();
    expect(weather?.icon).toBeUndefined();
  });

  it("treats null and non-numeric readings as absent", () => {
    const weather = parseWeather({
      temp: null,
      pressure: "1016",
      humidity: Number.NaN,
      clouds: { all: 100 },
      wind_speed: Number.POSITIVE_INFINITY,
    });

    expect(weather?.temp).toBeUndefined();
    expect(weather?.pressure).toBeUndefined();
    expect(weather?.humidity).toBeUndefined();
    expect(weather?.clouds).toBeUndefined();
    expect(weather?.windSpeed).toBeUndefined();
  });

  it("ignores a blank or non-string description", () => {
    expect(
      parseWeather({ weather: [{ description: "  " }] })?.description,
    ).toBeUndefined();
    expect(
      parseWeather({ weather: [{ description: 4 }] })?.description,
    ).toBeUndefined();
  });

  it("keeps a snapshot with no weather array readable", () => {
    expect(
      parseWeather({ temp: 15.5, weather: null })?.description,
    ).toBeUndefined();
  });

  it("reads the alerts the crawler merged in", () => {
    const weather = parseWeather({
      ...snapshot,
      alerts: [
        {
          event: "大雨警報",
          start: 1789415790,
          end: 1789460998,
          description: "土砂災害に注意してください。",
          tags: ["Rain"],
        },
      ],
    });

    expect(weather?.alerts).toEqual([
      {
        event: "大雨警報",
        start: 1789415790,
        end: 1789460998,
        description: "土砂災害に注意してください。",
      },
    ]);
  });

  it("drops alerts and malformed alert entries with nothing to show", () => {
    expect(parseWeather({ alerts: null })?.alerts).toEqual([]);
    expect(parseWeather({ alerts: "none" })?.alerts).toEqual([]);
    expect(
      parseWeather({ alerts: [null, {}, { event: "  " }] })?.alerts,
    ).toEqual([]);
  });
});

describe("hasWeather", () => {
  const of = (payload: unknown) => parseWeather(payload) as Weather;

  it("accepts a snapshot with anything worth rendering", () => {
    expect(hasWeather(of({ temp: 15.5 }))).toBe(true);
    expect(hasWeather(of({ weather: [{ description: "厚い雲" }] }))).toBe(true);
    expect(hasWeather(of({ weather: [{ icon: "04n" }] }))).toBe(true);
  });

  it("rejects an empty snapshot", () => {
    expect(hasWeather(of({}))).toBe(false);
    expect(hasWeather(of({ alerts: [] }))).toBe(false);
  });
});

describe("readings", () => {
  it("shows temperatures to one decimal place", () => {
    expect(formatTemperature(15.68)).toBe("15.7°C");
    expect(formatTemperature(0)).toBe("0°C");
    expect(formatTemperature(-4.26)).toBe("-4.3°C");
    expect(formatTemperature(undefined)).toBeUndefined();
  });

  it("shows pressure and percentages as whole numbers", () => {
    expect(formatPressure(1016)).toBe("1016 hPa");
    expect(formatPressure(1015.6)).toBe("1016 hPa");
    expect(formatPercent(78)).toBe("78%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("shows visibility in kilometres", () => {
    expect(formatVisibility(10000)).toBe("10 km");
    expect(formatVisibility(1234)).toBe("1.2 km");
    expect(formatVisibility(0)).toBe("0 km");
  });

  it("labels the UV index", () => {
    expect(formatUvIndex(0)).toBe("0 (弱い)");
    expect(formatUvIndex(3)).toBe("3 (中程度)");
    expect(formatUvIndex(6)).toBe("6 (強い)");
    expect(formatUvIndex(8)).toBe("8 (非常に強い)");
    expect(formatUvIndex(12)).toBe("12 (極端に強い)");
  });

  it("names the wind direction on a sixteen point compass", () => {
    expect(formatWindDirection(0)).toBe("N (0°)");
    expect(formatWindDirection(91)).toBe("E (91°)");
    expect(formatWindDirection(180)).toBe("S (180°)");
    expect(formatWindDirection(11.24)).toBe("N (11°)");
    expect(formatWindDirection(11.25)).toBe("NNE (11°)");
    expect(formatWindDirection(350)).toBe("N (350°)");
    expect(formatWindDirection(360)).toBe("N (0°)");
    expect(formatWindDirection(-90)).toBe("W (270°)");
    expect(formatWindDirection(undefined)).toBeUndefined();
  });

  it("joins wind speed and direction, and keeps whichever is present", () => {
    expect(formatWind(6.38, 91)).toBe("6.4 m/s E (91°)");
    expect(formatWind(6.38, undefined)).toBe("6.4 m/s");
    expect(formatWind(undefined, 91)).toBe("E (91°)");
    expect(formatWind(undefined, undefined)).toBeUndefined();
  });
});

describe("times", () => {
  it("renders timestamps in the crawler's time zone", () => {
    expect(formatTime(1789475291)).toBe("21:28");
    expect(formatTime(1789415790)).toBe("04:56");
    expect(formatTime(undefined)).toBeUndefined();
  });

  it("exposes a machine readable observation time", () => {
    expect(toDateTime(1789475291)).toBe("2026-09-15T12:28:11.000Z");
    expect(toDateTime(undefined)).toBeUndefined();
  });

  it("pairs alert start and end, falling back to whichever exists", () => {
    expect(formatTimeRange(1789415790, 1789460998)).toBe("04:56 – 17:29");
    expect(formatTimeRange(1789415790, undefined)).toBe("04:56");
    expect(formatTimeRange(undefined, 1789460998)).toBe("17:29");
    expect(formatTimeRange(undefined, undefined)).toBeUndefined();
  });
});

describe("weatherIconUrl", () => {
  it("points at the self-hosted icon", () => {
    expect(weatherIconUrl("04n")).toBe("/weather/04n.png");
    expect(weatherIconUrl("01d")).toBe("/weather/01d.png");
  });

  it("refuses anything outside the known icon codes", () => {
    expect(weatherIconUrl("../../etc/passwd")).toBeUndefined();
    expect(weatherIconUrl("99d")).toBeUndefined();
    expect(weatherIconUrl(undefined)).toBeUndefined();
  });
});

describe("buildDetails", () => {
  it("lists every reading the snapshot carries", () => {
    const details = buildDetails(parseWeather(snapshot) as Weather);

    expect(details).toEqual([
      { label: "体感温度", value: "15.3°C" },
      { label: "湿度", value: "78%" },
      { label: "露点", value: "11.9°C" },
      { label: "気圧", value: "1016 hPa" },
      { label: "雲量", value: "100%" },
      { label: "視程", value: "10 km" },
      { label: "UV指数", value: "0 (弱い)" },
      { label: "風", value: "6.4 m/s E (91°)" },
      { label: "突風", value: "9.1 m/s" },
      { label: "日の出", value: "04:56" },
      { label: "日の入り", value: "17:29" },
    ]);
  });

  it("skips the readings the snapshot does not carry", () => {
    const details = buildDetails(parseWeather({ temp: 15.5 }) as Weather);

    expect(details).toEqual([]);
  });

  it("keeps rain and snow apart when both are reported", () => {
    const details = buildDetails(
      parseWeather({ temp: 1.5, rain: 0.8, snow: 2.4 }) as Weather,
    );

    expect(details).toEqual([
      { label: "降水量 (1h)", value: "0.8 mm" },
      { label: "降雪量 (1h)", value: "2.4 mm" },
    ]);
  });
});
