/*
 * Post filter enhancement.
 *
 * The filter bar is a pair of radio groups and every card carries its own
 * category and year, both of which are rendered on the server. All this script
 * does is read the checked radios and toggle the `hidden` attribute on the
 * cards, so without JavaScript the full list stays visible.
 */

import {
  FILTER_ALL,
  matchesPostFilter,
  type CategoryFilter,
  type FilterablePost,
  type PostFilter,
} from "../utils/post-filter";

const CONTAINER_SELECTOR = "[data-post-filter]";
const GRID_SELECTOR = "[data-post-grid]";
const CARD_SELECTOR = "[data-post]";
const COUNT_SELECTOR = "[data-post-filter-count]";
const EMPTY_SELECTOR = "[data-post-empty]";
const RESET_SELECTOR = "[data-post-filter-reset]";

const readFilter = (container: HTMLElement): PostFilter => {
  const checkedValue = (group: string) =>
    container.querySelector<HTMLInputElement>(
      `input[data-filter-group="${group}"]:checked`,
    )?.value ?? FILTER_ALL;

  const year = checkedValue("year");

  return {
    category: checkedValue("category") as CategoryFilter,
    year: year === FILTER_ALL ? FILTER_ALL : Number(year),
  };
};

export const enhancePostFilter = () => {
  const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
  const grid = document.querySelector<HTMLElement>(GRID_SELECTOR);
  if (!container || !grid) return;

  const cards = [...grid.querySelectorAll<HTMLElement>(CARD_SELECTOR)].map(
    (element) => ({
      element,
      post: {
        category: element.dataset.category as FilterablePost["category"],
        year: Number(element.dataset.year),
      } satisfies FilterablePost,
    }),
  );

  if (cards.length === 0) return;

  const count = container.querySelector<HTMLElement>(COUNT_SELECTOR);
  const empty = document.querySelector<HTMLElement>(EMPTY_SELECTOR);

  /*
   * The filter is addressable. A category rail on the home page, a tag under an
   * article and a re-shared link all point at `/posts?category=...`, and the URL
   * is kept in step on every change so the state can be copied out of the
   * address bar. `replaceState` rather than `pushState`: a filter is a change to
   * the same page, not a new page to go back to, and a back button that stepped
   * through every press would bury the page the reader arrived from.
   */
  const syncUrl = (filter: PostFilter) => {
    const url = new URL(window.location.href);
    if (filter.category === FILTER_ALL) url.searchParams.delete("category");
    else url.searchParams.set("category", filter.category);
    if (filter.year === FILTER_ALL) url.searchParams.delete("year");
    else url.searchParams.set("year", String(filter.year));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const apply = () => {
    const filter = readFilter(container);
    let visible = 0;

    for (const card of cards) {
      const matches = matchesPostFilter(card.post, filter);
      card.element.hidden = !matches;
      if (matches) visible += 1;
    }

    if (count) {
      count.textContent =
        visible === cards.length
          ? `${cards.length} 件`
          : `${cards.length} 件中 ${visible} 件`;
    }

    if (empty) empty.hidden = visible > 0;

    syncUrl(filter);
  };

  /*
   * The empty result's way out. It lives inside the panel the reset hides, so
   * pressing it unmounts the control that was just used: focus is handed to the
   * first row that came back rather than dropped on the body, where the next Tab
   * would send the reader back to the top of the page.
   */
  document
    .querySelector<HTMLButtonElement>(RESET_SELECTOR)
    ?.addEventListener("click", () => {
      for (const input of container.querySelectorAll<HTMLInputElement>(
        "input[data-filter-group]",
      )) {
        input.checked = false;
      }

      apply();
      grid.querySelector<HTMLElement>(CARD_SELECTOR)?.focus();
    });

  /*
   * daisyUI's filter reset is a `type="reset"` inside the form. A `reset` event
   * does not bubble, so it is caught in the capture phase, and the form's own
   * values are restored only after the handler runs, so the re-read is deferred
   * one tick.
   */
  container.addEventListener(
    "reset",
    () => {
      window.setTimeout(apply, 0);
    },
    true,
  );

  /*
   * The state the URL asks for, applied before the first `apply` so the list
   * opens on the filter the link named. An unknown value is ignored and the
   * group stays on すべて, which is the safe direction: a stale link shows more
   * than it asked for rather than an empty page.
   */
  const params = new URLSearchParams(window.location.search);
  for (const group of ["category", "year"]) {
    const value = params.get(group);
    if (!value) continue;
    const input = container.querySelector<HTMLInputElement>(
      `input[data-filter-group="${group}"][value="${CSS.escape(value)}"]`,
    );
    if (input) input.checked = true;
  }

  container.addEventListener("change", apply);
  apply();
};
