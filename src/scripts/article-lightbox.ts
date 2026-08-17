import PhotoSwipeLightbox from "photoswipe/lightbox";
import type { SlideData } from "photoswipe";
import "photoswipe/style.css";
import { registerCaption } from "./photoswipe-caption";

const container = document.querySelector<HTMLElement>(".news-archive");

if (container) {
  const images = Array.from(
    container.querySelectorAll<HTMLImageElement>("img"),
  );

  if (images.length > 0) {
    const srcOf = (img: HTMLImageElement) => img.currentSrc || img.src;

    const toItem = (img: HTMLImageElement): SlideData => ({
      src: srcOf(img),
      width: img.naturalWidth || Number(img.getAttribute("width")) || undefined,
      height:
        img.naturalHeight || Number(img.getAttribute("height")) || undefined,
      alt: img.alt || undefined,
      msrc: srcOf(img),
    });

    const probe = (item: SlideData) =>
      new Promise<void>((resolve) => {
        if (item.width && item.height) {
          resolve();
          return;
        }

        const probeImg = new Image();
        probeImg.onload = () => {
          item.width = probeImg.naturalWidth || item.width;
          item.height = probeImg.naturalHeight || item.height;
          resolve();
        };
        probeImg.onerror = () => resolve();
        probeImg.src = item.src ?? "";
      });

    const lightbox = new PhotoSwipeLightbox({
      dataSource: [],
      indexIndicatorSep: " / ",
      pswpModule: () => import("photoswipe"),
    });

    lightbox.addFilter(
      "thumbEl",
      (thumb, _data, index) => images[index] ?? thumb,
    );

    registerCaption(lightbox);
    lightbox.init();

    container.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      const img = target?.closest<HTMLImageElement>("img");
      if (!img || !images.includes(img)) return;

      event.preventDefault();
      const items = images.map(toItem);
      Promise.all(items.map(probe)).then(() => {
        lightbox.options.dataSource = items;
        lightbox.loadAndOpen(images.indexOf(img));
      });
    });
  }
}
