/*
 * Vendored from `satteri-sanitize` (satteri-plugins), MIT © Ashish Vaghela —
 * https://github.com/Ashish-CodeJourney/satteri-plugins/tree/main/packages/satteri-sanitize
 *
 * Sätteri hands raw HTML to plugins unparsed, so anything written as HTML — or
 * generated as HTML by a plugin, as `mdast-katex` generates it — otherwise
 * reaches the page verbatim. This is the plugin that filters it.
 */
import { defineHastPlugin } from "satteri";
import { createSanitizer } from "./sanitize/filter";
import { TAG_NAMES } from "./sanitize/schema";
import {
  SITE_ATTRIBUTES,
  SITE_PROTOCOLS,
  SITE_TAG_NAMES,
} from "./sanitize/site-schema";
import { isAllowedUrl } from "./sanitize/url";

/** Block elements end a raw-text run, matching where parse5 recovers. */
const BLOCK_ELEMENTS = [
  "p",
  "div",
  "section",
  "blockquote",
  "pre",
  "li",
  "td",
  "th",
  "details",
  "summary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

/**
 * Filters raw HTML against the vendored default allowlist widened by
 * `site-schema.ts`.
 *
 * A factory rather than a definition, because the sanitiser carries
 * per-document state (the depth of a dropped run) and the same entry is reused
 * across compiles.
 */
export const hastSanitize = () => {
  const sanitizer = createSanitizer({
    tagNames: [...TAG_NAMES, ...SITE_TAG_NAMES],
    attributes: SITE_ATTRIBUTES,
    protocols: SITE_PROTOCOLS,
  });

  return defineHastPlugin({
    name: "hast-sanitize",
    raw: (node, ctx) => {
      const sanitized = sanitizer.sanitizeHtml(node.value);
      if (sanitized === node.value) return;
      if (sanitized === "") {
        ctx.removeNode(node);
        return;
      }
      return { type: "raw" as const, value: sanitized };
    },
    // Text between a dropped opening tag and its close is the payload of the
    // element being removed, so it goes with it.
    text: (node, ctx) => {
      if (sanitizer.dropsText()) ctx.removeNode(node);
    },
    /*
     * Elements Sätteri built from Markdown are structurally safe, but their URLs
     * come from the document and are not.
     */
    element: {
      filter: ["a", "img", ...BLOCK_ELEMENTS],
      visit: (node, ctx) => {
        if (BLOCK_ELEMENTS.includes(node.tagName)) sanitizer.endDropRun();

        for (const name of ["href", "src"]) {
          const value = node.properties?.[name];
          const allowed = sanitizer.protocolsFor(name);
          if (typeof value !== "string" || allowed === undefined) continue;
          if (!isAllowedUrl(value, allowed)) {
            ctx.setProperty(node, name, undefined);
          }
        }
      },
    },
  });
};
