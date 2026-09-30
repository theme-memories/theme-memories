import type { MarkdownHeading } from "astro";

interface TocItem {
  heading: MarkdownHeading;
  children: MarkdownHeading[];
}

/*
 * Post titles are rendered by the layout as the page `<h1>`, so content
 * headings start at `h2`. Only the first two levels are listed: deeper
 * headings belong to a section rather than structuring the article.
 */
const TOC_DEPTHS = new Set([2, 3]);

/** Group rendered headings into a two-level table of contents. */
export const buildToc = (headings: MarkdownHeading[]): TocItem[] => {
  const visible = headings.filter((heading) => TOC_DEPTHS.has(heading.depth));
  if (visible.length === 0) return [];

  // A document that opens at `h3` still gets a flat list rather than an empty
  // table of contents, so the outermost level is whatever is shallowest.
  const topDepth = Math.min(...visible.map((heading) => heading.depth));

  return visible.reduce<TocItem[]>((items, heading) => {
    const last = items.at(-1);
    if (heading.depth === topDepth || last === undefined) {
      items.push({ heading, children: [] });
    } else {
      last.children.push(heading);
    }
    return items;
  }, []);
};
