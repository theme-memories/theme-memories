/*
 * Vendored from `satteri-sanitize` (satteri-plugins), MIT © Ashish Vaghela —
 * https://github.com/Ashish-CodeJourney/satteri-plugins/tree/main/packages/satteri-sanitize
 *
 * Node and attribute names are in hast's spelling (`className`, not `class`),
 * which is what the sanitiser compares against.
 */

/**
 * Default allowlist, ported from `hast-util-sanitize`'s `defaultSchema`, which
 * follows GitHub's Markdown sanitisation rules.
 *
 * Only raw HTML in a document is filtered against it: Markdown's own elements
 * are built by the parser, and the sanitiser checks their URLs rather than their
 * attributes. That is why this list can stay this narrow while the site keeps
 * inline styles, galleries and media.
 */

/** Elements that survive sanitisation. Anything else is unwrapped. */
export const TAG_NAMES: readonly string[] = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "source",
  "span",
  "strike",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tt",
  "ul",
  "var",
];

/**
 * Elements whose text content is dropped along with the element.
 *
 * `style` is deliberately absent: `rehype-sanitize` unwraps it and keeps the
 * text, and matching that avoids a surprising divergence. The text is inert
 * either way.
 */
export const DROP_CONTENT: readonly string[] = ["script"];

/** Attributes allowed on every element. */
export const GLOBAL_ATTRIBUTES: readonly string[] = ["dir", "lang", "title"];

/** Attributes allowed per element, in addition to the global ones. */
export const ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "name"],
  img: ["src", "alt", "longdesc", "height", "width"],
  li: ["value"],
  ol: ["start"],
  source: ["srcset", "type", "media"],
  td: ["colspan", "rowspan", "align"],
  th: ["colspan", "rowspan", "align"],
  div: ["itemscope", "itemtype"],
  code: ["className"],
  pre: ["className"],
  span: ["className"],
  del: ["cite"],
  ins: ["cite"],
  q: ["cite"],
  blockquote: ["cite"],
};

/**
 * Attributes carrying a URL, and the protocols each may use. A protocol not
 * listed here means the attribute is dropped.
 */
export const PROTOCOLS: Readonly<Record<string, readonly string[]>> = {
  href: ["http", "https", "mailto", "xmpp", "irc", "ircs"],
  src: ["http", "https"],
  longdesc: ["http", "https"],
  cite: ["http", "https"],
};

/** Attributes that can clobber `document` properties and so get a prefix. */
export const CLOBBER: readonly string[] = ["id", "name"];

/**
 * Attributes whose canonical spelling is not lower case.
 *
 * HTML lower-cases attribute names, and the sanitiser matches the allowlist in
 * that form, but SVG's names are case-sensitive: an `<svg>` serialized with
 * `viewbox` loses the coordinate system KaTeX draws with. The canonical spelling
 * is restored from here at serialization time, so the allowlist keeps one
 * comparison form.
 */
export const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
};

export const CLOBBER_PREFIX = "user-content-";

/**
 * Class values kept on `code`, `pre` and `span`. Sätteri uses `language-*` for
 * fenced code, and `math-inline` / `math-display` for maths.
 */
export const CLASS_PREFIXES: readonly string[] = ["language-", "math"];
