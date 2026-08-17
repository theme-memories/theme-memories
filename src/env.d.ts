type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Locals extends Runtime {}

  interface SessionData {
    user_id: string;
  }
}

interface SubtleCrypto {
  timingSafeEqual(
    a: ArrayBuffer | ArrayBufferView,
    b: ArrayBuffer | ArrayBufferView,
  ): boolean;
}

declare module "photoswipe-dynamic-caption-plugin" {
  import type PhotoSwipeLightbox from "photoswipe/lightbox";

  interface DynamicCaptionOptions {
    captionContent?: string | ((slide: { data: { alt?: string } }) => string);
    type?: "auto" | "below" | "aside";
    mobileLayoutBreakpoint?:
      number | ((pswp: unknown, captionPlugin: unknown) => boolean);
    horizontalEdgeThreshold?: number;
    mobileCaptionOverlapRatio?: number;
    verticallyCenterImage?: boolean;
  }

  export default class PhotoSwipeDynamicCaption {
    constructor(lightbox: PhotoSwipeLightbox, options?: DynamicCaptionOptions);
  }
}
