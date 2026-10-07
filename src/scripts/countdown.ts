/*
 * Countdown enhancement.
 *
 * A daisyUI countdown is a still number: the digits roll only when the `--value`
 * variable and the text change, which the library leaves to a script. The
 * specimen on the style guide is ticked down from 42 and wraps, so the
 * component's transition is visible. A reader who asked for less motion keeps
 * the static number the markup already renders.
 */
export const enhanceCountdown = () => {
  const countdown = document.querySelector<HTMLElement>("[data-countdown]");
  const value = countdown?.querySelector<HTMLElement>("[data-countdown-value]");
  if (!countdown || !value) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const start = Number(value.dataset.countdownValue) || 42;
  let current = start;

  window.setInterval(() => {
    current = current <= 0 ? start : current - 1;
    value.style.setProperty("--value", String(current));
    value.textContent = String(current);
    countdown.setAttribute("aria-label", String(current));
  }, 1000);
};
