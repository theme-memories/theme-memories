const btn = document.querySelector<HTMLElement>(".js-sort-btn");
const menu = document.querySelector<HTMLElement>(".js-sort-menu");
const items = Array.from(
  document.querySelectorAll<HTMLElement>(".js-news-item"),
);

const allValue = { cat: "cat-all", year: "year-all" } as const;
type FilterGroup = keyof typeof allValue;

const toggle = () => {
  const open = menu?.classList.toggle("js-open") ?? false;
  btn?.classList.toggle("js-open", open);
};

btn?.addEventListener("click", toggle);
menu?.addEventListener("click", (event) => {
  if (event.target === menu) toggle();
});

const getActive = (group: FilterGroup): string =>
  document
    .querySelector(`.js-${group}.is-active`)
    ?.getAttribute(`data-${group}`) ?? allValue[group];

const applyFilter = () => {
  const cat = getActive("cat");
  const year = getActive("year");
  items.forEach((item) => {
    const matchCat = cat === allValue.cat || item.dataset.cat === cat;
    const matchYear = year === allValue.year || item.dataset.year === year;
    item.style.display = matchCat && matchYear ? "" : "none";
  });
};

document.querySelectorAll<HTMLElement>(".js-cat, .js-year").forEach((chip) => {
  chip.addEventListener("click", () => {
    const group: FilterGroup = chip.classList.contains("js-cat")
      ? "cat"
      : "year";
    chip.parentElement
      ?.querySelectorAll<HTMLElement>(`.js-${group}`)
      .forEach((sibling) => sibling.classList.remove("is-active"));
    chip.classList.add("is-active");
    applyFilter();
  });
});

export {};
