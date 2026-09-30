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
        input.checked = input.value === FILTER_ALL;
      }

      apply();
      grid.querySelector<HTMLElement>(CARD_SELECTOR)?.focus();
    });

  container.addEventListener("change", apply);
  apply();
};
