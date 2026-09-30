import { defineHastPlugin } from "satteri";

/*
 * Content images load with the page rather than on approach.
 *
 * The loader veil covers the viewport until the document has loaded, and a lazy
 * image is by definition not part of that: it is requested once it comes near
 * the viewport, so it arrives after the veil has lifted and the reader watches
 * the prose fill in. Eager images are counted by the load event, which is what
 * the loader waits on, so the veil cannot lift while one is still missing.
 *
 * Only `img` is touched. A media element is left as the author wrote it, so an
 * unpressed <video> still costs nothing but its metadata.
 */
export const hastEagerImages = defineHastPlugin({
  name: "hast-eager-images",
  element: {
    filter: ["img"],
    visit(node, context) {
      context.setProperty(node, "loading", "eager");
    },
  },
});
