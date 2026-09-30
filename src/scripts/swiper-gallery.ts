/*
 * Swiper gallery enhancement.
 *
 * A gallery is authored as nothing more than images inside a `.swiper-gallery`
 * container — which is what Markdown can express and what the Astro component
 * renders. Swiper needs its own wrapper, slides and controls to exist before it
 * can be initialised, so that structure is built here in the browser: without
 * JavaScript the images stay a plain stack, and Swiper itself is only fetched on
 * pages that actually contain a gallery.
 */

const GALLERY_SELECTOR = ".swiper-gallery";
const ENHANCED_ATTRIBUTE = "data-swiper-enhanced";

/*
 * The gallery's own words. Swiper's accessibility module writes its messages
 * onto the controls it is handed, so the buttons built below and the messages
 * passed to Swiper are read from one place rather than kept in step by hand.
 *
 * `{{index}}` and `{{slidesLength}}` are Swiper's placeholders, not ours, and
 * the slide label is the same `n / total` the pagination readout prints, so what
 * a screen reader hears and what the page shows cannot drift apart.
 */
const A11Y_TEXTS = {
  prevSlideMessage: "前のスライド",
  nextSlideMessage: "次のスライド",
  firstSlideMessage: "最初のスライドです",
  lastSlideMessage: "最後のスライドです",
  slideLabelMessage: "{{index}} / {{slidesLength}}",
  containerRoleDescriptionMessage: "カルーセル",
} as const;

const createControl = (className: string, label: string) => {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.setAttribute("aria-label", label);
  return control;
};

const buildGallery = (gallery: HTMLElement) => {
  const images = gallery.querySelectorAll<HTMLImageElement>("img");
  if (images.length === 0) return undefined;

  const wrapper = document.createElement("div");
  wrapper.className = "swiper-wrapper";

  for (const image of images) {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    slide.appendChild(image);
    wrapper.appendChild(slide);
  }

  const pagination = document.createElement("div");
  pagination.className = "swiper-pagination";
  const previous = createControl(
    "swiper-button-prev",
    A11Y_TEXTS.prevSlideMessage,
  );
  const next = createControl("swiper-button-next", A11Y_TEXTS.nextSlideMessage);
  gallery.replaceChildren(wrapper, pagination, previous, next);
  gallery.classList.add("swiper");

  return { pagination, previous, next };
};

export const enhanceSwiperGalleries = () => {
  const galleries = [
    ...document.querySelectorAll<HTMLElement>(GALLERY_SELECTOR),
  ].filter((gallery) => !gallery.hasAttribute(ENHANCED_ATTRIBUTE));

  if (galleries.length === 0) return;

  // Marked before the import resolves: both the layout and the component call
  // this, and only the first call should build a given gallery.
  for (const gallery of galleries) {
    gallery.setAttribute(ENHANCED_ATTRIBUTE, "");
  }

  void Promise.all([import("swiper"), import("swiper/modules")]).then(
    ([swiperModule, modules]) => {
      for (const gallery of galleries) {
        const controls = buildGallery(gallery);
        if (!controls) continue;

        new swiperModule.default(gallery, {
          modules: [modules.A11y, modules.Navigation, modules.Pagination],
          navigation: {
            prevEl: controls.previous,
            nextEl: controls.next,
          },
          /*
           * A fraction, not one bullet per slide. This gallery holds 41 drawings,
           * and the default would print 41 eight-pixel dots across the page:
           * targets far under the 44px floor the rest of the site keeps, with the
           * current slide marked by colour alone. A readout says the same thing
           * in words and stays legible however many drawings are added.
           */
          pagination: {
            el: controls.pagination,
            type: "fraction",
          },
          a11y: {
            containerRole: "group",
            ...A11Y_TEXTS,
          },
        });
      }
    },
  );
};
