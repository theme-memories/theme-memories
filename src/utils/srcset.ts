import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

/*
 * Builds the `srcset` for an art-directed <source>.
 *
 * Astro's <Picture> only swaps formats per <source>, so a change of *image* at
 * a breakpoint has to be written by hand, and the srcset beside it has to be
 * built by hand too. getImage() runs every candidate through the same pipeline
 * as <Image>, so a hand-written set is optimised the same way rather than
 * falling back to the original file.
 *
 * Both art-directed surfaces — the home masthead and the character band — build
 * their sets here, so the format and the string shape cannot drift apart.
 */
export const toSrcset = async (
  src: ImageMetadata,
  widths: number[],
): Promise<string> =>
  (
    await Promise.all(
      widths.map(async (width) => {
        const { src: url } = await getImage({ src, width, format: "webp" });
        return `${url} ${width}w`;
      }),
    )
  ).join(", ");
