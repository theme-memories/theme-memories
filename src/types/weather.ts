export interface TransformedWeatherData {
  weather: {
    description: string;
    icon: string;
  };
  temperature: {
    current: number;
    feelsLike: number;
    min: number;
    max: number;
  };
  atmospheric: {
    pressure: number;
    humidity: number;
    seaLevel: number;
    groundLevel: number;
    visibility: number;
  };
  wind: {
    speed: number;
    direction: number;
    gust: number;
  };
  clouds: number;
  sun: {
    sunrise: number;
    sunset: number;
  };
  lastUpdated: number;
  rain?: number;
  snow?: number;
}
