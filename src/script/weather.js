// Function to fetch weather data from the API
export async function getWeatherData() {
  // Using a placeholder URL for your new API endpoint
  const url = `https://object.amia.work/weather`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // The data is already transformed by your API
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

// Function to update the weather widget with new data
export function updateWeatherWidget(widget, data) {
  if (!data) {
    widget.innerHTML = "<p>気象データの読み込みに失敗しました。</p>";
    return;
  }

  const { weather, temperature, atmospheric, wind, sun, lastUpdated } = data;
  const widgetSize = widget.dataset.size || "small";

  const locale = "ja-JP-u-ca-japanese";
  const timeOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  const dateTimeOptions = {
    era: "long",
    calendar: "japanese",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  const sunriseTime = new Date(sun.sunrise * 1000).toLocaleTimeString(
    locale,
    timeOptions,
  );
  const sunsetTime = new Date(sun.sunset * 1000).toLocaleTimeString(
    locale,
    timeOptions,
  );
  const updatedTime = new Date(lastUpdated * 1000).toLocaleString(
    locale,
    dateTimeOptions,
  );

  let html = `
    <div class="weather-header">
      <img src="https://openweathermap.org/payload/api/media/file/${weather.icon}.png" alt="${weather.description}">
      <h2><span>${weather.description}</span><span>${temperature.current}°C</span></h2>
    </div>
    
  `;

  if (widgetSize === "big") {
    html += `
      <div class="weather-content">
        <p>体感温度: ${temperature.feelsLike}°C</p>
        <p>最低: ${temperature.min}°C, 最高: ${temperature.max}°C</p>
        <p>湿度: ${atmospheric.humidity}%</p>
        <p>風速: ${wind.speed} m/s</p>
        <p>日の出: ${sunriseTime}</p>
        <p>日の入り: ${sunsetTime}</p>
        <p class="last-updated">最終更新: ${updatedTime}</p>
      </div>
    `;
  }

  widget.innerHTML = html;
}
