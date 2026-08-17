const btn = document.querySelector(".header-btn");
const nav = document.querySelector(".header-nav");
const navBg = document.querySelector(".header-nav-bg");
const links = document.querySelectorAll(".header-nav-list a");

const closeNav = () => {
  btn?.classList.remove("js-open");
  nav?.classList.remove("js-open");
  document.body.classList.remove("js-no-scroll");
};

const toggle = () => {
  const open = nav?.classList.toggle("js-open") ?? false;
  btn?.classList.toggle("js-open", open);
  document.body.classList.toggle("js-no-scroll", open);
};

btn?.addEventListener("click", toggle);
navBg?.addEventListener("click", closeNav);
links.forEach((link) => link.addEventListener("click", closeNav));

window.addEventListener("load", () => {
  document
    .querySelectorAll(".header .js-top, .hero .js-catch")
    .forEach((el) => el.classList.add("js-show"));
});
