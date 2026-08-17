import Swiper from "swiper";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { registerCaption } from "./photoswipe-caption";

const media = window.matchMedia("(max-width: 767px)");
const slider = document.querySelector(
  ".chara-card-slide",
) as HTMLElement | null;
const grid = document.querySelector(".chara-card-grid") as HTMLElement | null;

let swiper: Swiper | null = null;
let lightbox: PhotoSwipeLightbox | null = null;

const initSwiper = () => {
  if (media.matches && !swiper && slider) {
    swiper = new Swiper(slider, {
      modules: [Autoplay, Pagination],
      slidesPerView: 1.2,
      centeredSlides: true,
      loop: true,
      spaceBetween: "5%",
      autoplay: { delay: 5000, disableOnInteraction: false },
      pagination: {
        el: ".chara-card-pagination",
        type: "bullets",
        clickable: true,
        dynamicBullets: true,
      },
    });
  }
};

const destroySwiper = () => {
  swiper?.destroy(true, true);
  swiper = null;
};

const initLightbox = () => {
  if (lightbox || !grid) return;

  lightbox = new PhotoSwipeLightbox({
    gallery: grid,
    children: "a",
    indexIndicatorSep: " / ",
    pswpModule: () => import("photoswipe"),
  });
  registerCaption(lightbox);
  lightbox.init();
};

const destroyLightbox = () => {
  lightbox?.destroy();
  lightbox = null;
};

const sync = () => {
  if (media.matches) {
    initSwiper();
    destroyLightbox();
  } else {
    destroySwiper();
    initLightbox();
  }
};

window.addEventListener("resize", sync);
sync();
