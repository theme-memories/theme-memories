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

  const locale = "ja-JP";
  const timeOptions = { hour: "2-digit", minute: "2-digit" };
  const dateTimeOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

  const logo = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;

  let html = `
    <div class="weather-header">
      ${logo}
      <h2>天気 - ${weather.description}</h2>
      <img src="http://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}">
    </div>
    <div class="weather-content">
      <p>温度: ${temperature.current}°C</p>
  `;

  if (widgetSize === "big") {
    html += `
      <p>体感温度: ${temperature.feelsLike}°C</p>
      <p>最低: ${temperature.min}°C, 最高: ${temperature.max}°C</p>
      <p>湿度: ${atmospheric.humidity}%</p>
      <p>風速: ${wind.speed} m/s</p>
      <p>日の出: ${sunriseTime}</p>
      <p>日の入り: ${sunsetTime}</p>
    `;
  }

  html += `
      <p class="last-updated">最終更新: ${updatedTime}</p>
    </div>
  `;

  widget.innerHTML = html;
}
