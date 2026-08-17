let year = "now";

const param = new URLSearchParams(window.location.search).get("year");
if (param === "past" || param === "now") {
  year = param;
}

const applyChange = () => {
  document
    .querySelectorAll(".js-change")
    .forEach((el) => el.classList.remove("js-visible"));
  document
    .querySelectorAll(`.js-change.${year}`)
    .forEach((el) => el.classList.add("js-visible"));
  document.querySelectorAll(".js-change-class").forEach((el) => {
    el.classList.remove("now", "past");
    el.classList.add(year);
  });
};

if (param === "past" || param === "now") {
  document
    .querySelectorAll<HTMLAnchorElement>(".chara-sub-btn")
    .forEach((btn) => {
      btn.classList.toggle("js-current", btn.dataset.year === year);
    });
  applyChange();
}

document
  .querySelectorAll<HTMLAnchorElement>(".chara-sub-btn")
  .forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      year = btn.dataset.year ?? "now";
      document
        .querySelectorAll<HTMLAnchorElement>(".chara-sub-btn")
        .forEach((b) => b.classList.remove("js-current"));
      btn.classList.add("js-current");
      const show = document.querySelector(".js-change-show");
      show?.classList.add("js-hide");
      setTimeout(applyChange, 600);
      setTimeout(() => show?.classList.remove("js-hide"), 800);
    });
  });

const reveal = () => {
  const viewport = window.innerHeight;
  document.querySelectorAll(".js-scroll").forEach((el) => {
    if (el.getBoundingClientRect().top < viewport - 100) {
      el.classList.add("js-show");
    }
  });
};

window.addEventListener("scroll", reveal, { passive: true });

if (document.readyState === "complete") {
  reveal();
} else {
  window.addEventListener("load", reveal);
}
