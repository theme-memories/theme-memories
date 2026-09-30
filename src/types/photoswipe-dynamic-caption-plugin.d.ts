// `photoswipe-dynamic-caption-plugin` ships JavaScript without type
// declarations, so the surface used by the post layout is declared here.
declare module "photoswipe-dynamic-caption-plugin" {
  import type PhotoSwipeLightbox from "photoswipe/lightbox";

  interface PhotoSwipeDynamicCaptionOptions {
    captionContent?:
      string | ((slide: { data: { element: HTMLElement } }) => string | null);
    type?: "auto" | "below" | "aside";
    horizontalEdgeThreshold?: number;
    mobileCaptionOverlapRatio?: number;
    mobileLayoutBreakpoint?:
      number | ((pswp: unknown, plugin: unknown) => boolean);
    verticallyCenterImage?: boolean;
  }

  export default class PhotoSwipeDynamicCaption {
    constructor(
      lightbox: PhotoSwipeLightbox,
      options?: PhotoSwipeDynamicCaptionOptions,
    );
  }
}
