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
    widget.innerHTML = "<p>Failed to load weather data.</p>";
    return;
  }

  const { weather, temperature, atmospheric, wind, sun, lastUpdated } = data;
  const widgetSize = widget.dataset.size || "small";

  const sunriseTime = new Date(sun.sunrise * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sunsetTime = new Date(sun.sunset * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const updatedTime = new Date(lastUpdated * 1000).toLocaleTimeString();

  let html = `
    <div class="weather-header">
      <h2>${weather.description}</h2>
      <img src="http://openweathermap.org/img/wn/${weather.icon}.png" alt="${weather.description}">
    </div>
    <div class="weather-content">
      <p>Temperature: ${temperature.current}°C</p>
  `;

  if (widgetSize === "big") {
    html += `
      <p>Feels like: ${temperature.feelsLike}°C</p>
      <p>Min: ${temperature.min}°C, Max: ${temperature.max}°C</p>
      <p>Humidity: ${atmospheric.humidity}%</p>
      <p>Wind: ${wind.speed} m/s</p>
      <p>Sunrise: ${sunriseTime}</p>
      <p>Sunset: ${sunsetTime}</p>
    `;
  }

  html += `
      <p class="last-updated">Last updated: ${updatedTime}</p>
    </div>
  `;

  widget.innerHTML = html;
}
