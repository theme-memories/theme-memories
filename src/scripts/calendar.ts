/*
 * Cally calendar enhancement.
 *
 * The calendar specimen is a web component, authored as plain
 * `<calendar-date class="cally">`. Importing the package registers the custom
 * elements, and the theme's `.cally` rules style their shadow parts; nothing has
 * to be constructed here. The import is deferred until a calendar is actually on
 * the page, so no other page downloads it.
 */

const CALENDAR_SELECTOR = "calendar-date";

export const enhanceCalendar = (): void => {
  if (!document.querySelector(CALENDAR_SELECTOR)) return;
  void import("cally");
};
