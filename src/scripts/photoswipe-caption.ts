import PhotoSwipeDynamicCaption from "photoswipe-dynamic-caption-plugin";
import "photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css";
import type PhotoSwipeLightbox from "photoswipe/lightbox";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const registerCaption = (lightbox: PhotoSwipeLightbox): void => {
  new PhotoSwipeDynamicCaption(lightbox, {
    type: "below",
    captionContent: (slide) => escapeHtml(slide.data.alt?.trim() ?? ""),
  });
};
