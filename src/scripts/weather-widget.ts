/*
 * Weather widget enhancement.
 *
 * The snapshot behind the card is rebuilt every ten minutes, so it is fetched
 * here rather than during the build, when the reading would be frozen into the
 * page. Every value is written through `textContent`, so the crawled payload is
 * never parsed as markup.
 */

import {
  WEATHER_ENDPOINT,
  WEATHER_PLACEHOLDER,
  buildDetails,
  formatTemperature,
  formatTime,
  formatTimeRange,
  hasWeather,
  parseWeather,
  toDateTime,
  weatherIconUrl,
  type Weather,
  type WeatherAlert,
} from "../utils/weather";

const ROOT_SELECTOR = "[data-weather]";
const REQUEST_TIMEOUT_MS = 10_000;

/*
 * The Worker type environment merges the HTMLRewriter `Element` into the global
 * one, which makes every `Element` incompatible with `ParentNode`, so the roots
 * this script queries within are listed explicitly.
 */
type QueryRoot = HTMLElement | DocumentFragment;

const query = <T extends Element>(root: QueryRoot, selector: string) =>
  root.querySelector<T>(selector);

const setText = (element: Element | null, text: string) => {
  if (element) element.textContent = text;
};

/* Renders a templated row, dropping the parts the snapshot has no value for. */
const fill = (
  node: DocumentFragment,
  selector: string,
  text: string | undefined,
) => {
  const element = node.querySelector<HTMLElement>(selector);
  if (!element) return;

  if (text === undefined) element.remove();
  else element.textContent = text;
};

const renderIcon = (container: Element | null, weather: Weather) => {
  const src = weatherIconUrl(weather.icon);
  if (!container || !src) return;

  const icon = document.createElement("img");
  icon.src = src;
  icon.alt = "";
  icon.width = 100;
  icon.height = 100;
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.className = "size-full object-contain";
  container.replaceChildren(icon);
};

const renderDetails = (root: QueryRoot, weather: Weather) => {
  const report = query<HTMLElement>(root, "[data-weather-report]");
  const list = query<HTMLElement>(root, "[data-weather-details]");
  const template = query<HTMLTemplateElement>(
    root,
    "[data-weather-detail-template]",
  );
  if (!report || !list || !template) return;

  const details = buildDetails(weather);
  if (details.length === 0) return;

  list.replaceChildren(
    ...details.map(({ label, value }) => {
      const row = template.content.cloneNode(true) as DocumentFragment;
      setText(row.querySelector("dt"), label);
      setText(row.querySelector("dd"), value);
      return row;
    }),
  );
  report.hidden = false;
};

const renderAlerts = (root: QueryRoot, alerts: WeatherAlert[]) => {
  const container = query<HTMLElement>(root, "[data-weather-alerts]");
  const template = query<HTMLTemplateElement>(
    root,
    "[data-weather-alert-template]",
  );
  if (!container || !template || alerts.length === 0) return;

  container.replaceChildren(
    ...alerts.map((alert) => {
      const node = template.content.cloneNode(true) as DocumentFragment;
      fill(node, "[data-alert-event]", alert.event);
      fill(node, "[data-alert-time]", formatTimeRange(alert.start, alert.end));
      fill(node, "[data-alert-description]", alert.description);
      return node;
    }),
  );
  container.hidden = false;
};

export const enhanceWeatherWidget = () => {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;

  const loading = query<HTMLElement>(root, "[data-weather-loading]");
  const content = query<HTMLElement>(root, "[data-weather-content]");
  const error = query<HTMLElement>(root, "[data-weather-error]");
  const live = query<HTMLElement>(root, "[data-weather-live]");
  const retry = query<HTMLButtonElement>(root, "[data-weather-retry]");

  const settle = () => live?.setAttribute("aria-busy", "false");

  const fail = (message: string) => {
    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (retry) retry.hidden = false;
    settle();
  };

  const render = (weather: Weather) => {
    setText(
      query(root, "[data-weather-temp]"),
      formatTemperature(weather.temp) ?? WEATHER_PLACEHOLDER,
    );
    setText(
      query(root, "[data-weather-description]"),
      weather.description ?? WEATHER_PLACEHOLDER,
    );
    renderIcon(query(root, "[data-weather-icon]"), weather);

    const feelsLike = query<HTMLElement>(root, "[data-weather-feels-like]");
    const feelsLikeLabel = formatTemperature(weather.feelsLike);
    if (feelsLike && feelsLikeLabel) {
      feelsLike.textContent = `体感 ${feelsLikeLabel}`;
      feelsLike.hidden = false;
    }

    const updated = query<HTMLElement>(root, "[data-weather-updated]");
    const observed = query<HTMLTimeElement>(root, "[data-weather-observed]");
    const observedLabel = formatTime(weather.dt);
    if (updated && observed && observedLabel) {
      const dateTime = toDateTime(weather.dt);
      observed.textContent = observedLabel;
      if (dateTime) observed.dateTime = dateTime;
      updated.hidden = false;
    }

    renderDetails(root, weather);
    renderAlerts(root, weather.alerts);

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (retry) retry.hidden = true;
    if (content) content.hidden = false;
    settle();
  };

  const load = async () => {
    /*
     * Every attempt starts from the same place, so a retry puts the skeleton
     * back rather than leaving the failed line on screen while the request it
     * just replaced is still in flight.
     *
     * The reading, the details and any alerts all land in the one live region,
     * and a polite region announces each insertion as it arrives. Holding the
     * region busy across the request batches them into a single announcement of
     * the finished reading, which is the thing worth hearing once. Set from here
     * rather than in the markup, so a browser without scripting is never left
     * holding a region that is permanently busy.
     */
    if (loading) loading.hidden = false;
    if (error) error.hidden = true;
    if (retry) retry.hidden = true;
    if (content) content.hidden = true;
    live?.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(WEATHER_ENDPOINT, {
        headers: { accept: "application/json" },
        /*
         * No `cache: "no-store"` here. The snapshot is served with its own
         * `max-age`, so opting out of the HTTP cache only meant every page view
         * re-downloaded an unchanged file; the crawler rewrites the object every
         * ten minutes anyway.
         */
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Snapshot request failed with ${response.status}`);
      }

      const weather = parseWeather(await response.json());
      if (!weather || !hasWeather(weather)) {
        fail("天気データがまだありません。");
        return;
      }

      render(weather);
    } catch {
      fail("天気を読み込めませんでした。");
    }
  };

  /*
   * The button is unmounted by its own action, so focus is parked on the plate
   * first. Left on the button, it would fall through to `body` and the next Tab
   * would restart at the top of the page.
   */
  retry?.addEventListener("click", () => {
    root.focus();
    void load();
  });

  void load();
};
