/*
 * The filtering rules, kept apart from the Sätteri plugin that drives them.
 *
 * The plugin is the wiring — which node types are visited and how a mutation is
 * reported. The decisions live here, so they can be tested on their own and so
 * the vendored rules stay readable.
 */
import { escapePreservingEntities, serializeTag, tokenize } from "./html";
import type { Tag } from "./html";
import {
  ATTRIBUTE_NAMES,
  ATTRIBUTES,
  CLASS_PREFIXES,
  CLOBBER,
  CLOBBER_PREFIX,
  DROP_CONTENT,
  GLOBAL_ATTRIBUTES,
  PROTOCOLS,
  TAG_NAMES,
} from "./schema";
import { isAllowedUrl } from "./url";

type SanitizeOptions = {
  /** Elements to keep. Anything else is unwrapped, keeping its children. */
  tagNames?: readonly string[];
  /** Extra attributes per element, merged over the defaults. */
  attributes?: Readonly<Record<string, readonly string[]>>;
  /** Allowed protocols per URL attribute, merged over the defaults. */
  protocols?: Readonly<Record<string, readonly string[]>>;
  /**
   * Added to `id` and `name` so raw HTML cannot clobber a `document` property —
   * including the ids this site's own scripts look up.
   */
  clobberPrefix?: string;
};

/** Event handlers are never allowed, whatever the allowlist says. */
const isEventHandler = (name: string): boolean => /^on[a-z]/i.test(name);

export const createSanitizer = ({
  tagNames = TAG_NAMES,
  attributes = {},
  protocols = {},
  clobberPrefix = CLOBBER_PREFIX,
}: SanitizeOptions = {}) => {
  const allowedTags = new Set(tagNames.map((name) => name.toLowerCase()));
  const allowedAttributes: Readonly<Record<string, readonly string[]>> = {
    ...ATTRIBUTES,
    ...attributes,
  };
  const allowedProtocols: Readonly<Record<string, readonly string[]>> = {
    ...PROTOCOLS,
    ...protocols,
  };

  /*
   * Text between a dropped opening tag and its close is the payload of the
   * element being removed, so it goes with it. The depth is per document, which
   * is why the caller makes one sanitiser per compile.
   */
  let dropDepth = 0;

  /** `class` in HTML is `className` in a hast schema; accept either spelling. */
  const listed = (tagName: string, name: string): boolean => {
    const list = allowedAttributes[tagName] ?? [];
    if (name !== "class" && name !== "className") return list.includes(name);
    return list.includes("class") || list.includes("className");
  };

  const attributeAllowed = (tagName: string, name: string): boolean =>
    GLOBAL_ATTRIBUTES.includes(name) ||
    CLOBBER.includes(name) ||
    listed(tagName, name);

  /** True when the caller opted this element's class through, not the default schema. */
  const classIsConfigured = (tagName: string): boolean => {
    const list = attributes[tagName] ?? [];
    return list.includes("class") || list.includes("className");
  };

  const keptClasses = (value: string): string =>
    value
      .split(/\s+/)
      .filter((token) =>
        CLASS_PREFIXES.some((prefix) => token.startsWith(prefix)),
      )
      .join(" ");

  const cleanValue = (name: string, value: string): string | undefined => {
    const allowed = allowedProtocols[name];
    if (allowed !== undefined && !isAllowedUrl(value, allowed))
      return undefined;
    if (CLOBBER.includes(name)) return clobberPrefix + value;
    return value;
  };

  const cleanAttributes = (tag: Tag): Array<readonly [string, string]> => {
    const kept: Array<readonly [string, string]> = [];

    for (const [rawName, value] of tag.attributes) {
      /*
       * Matched in lower case, but serialized in the canonical spelling: SVG's
       * `viewBox` and `preserveAspectRatio` are case-sensitive, so a lower-cased
       * name would leave the drawing without its coordinate system.
       */
      const lower = rawName.toLowerCase();
      const name = ATTRIBUTE_NAMES[lower] ?? lower;
      if (isEventHandler(name)) continue;
      if (!attributeAllowed(tag.name, name)) continue;

      /*
       * The default schema lets `class` carry only Sätteri's own `language-*`
       * and `math*` markers, so unknown classes are filtered out. An element
       * whose class the caller allowed keeps its value untouched.
       */
      if (name === "class" && !classIsConfigured(tag.name)) {
        const classes = keptClasses(value);
        if (classes !== "") kept.push([name, classes]);
        continue;
      }

      const cleaned = cleanValue(name, value);
      if (cleaned !== undefined) kept.push([name, cleaned]);
    }

    return kept;
  };

  /** Filters a raw HTML string down to the allowed elements and attributes. */
  const sanitizeHtml = (html: string): string => {
    let output = "";

    for (const token of tokenize(html)) {
      if (token.kind === "text") {
        if (dropDepth === 0) output += escapePreservingEntities(token.value);
        continue;
      }

      if (DROP_CONTENT.includes(token.name)) {
        if (token.closing) dropDepth = Math.max(0, dropDepth - 1);
        else dropDepth += 1;
        continue;
      }

      if (dropDepth > 0) continue;
      if (!allowedTags.has(token.name)) continue;

      output += serializeTag(token, cleanAttributes(token));
    }

    return output;
  };

  return {
    sanitizeHtml,
    /** Whether a text node is the payload of an element being dropped. */
    dropsText: () => dropDepth > 0,
    /**
     * Block elements end a raw-text run, so an unclosed `<script>` cannot
     * swallow the rest of the document the way parse5 would not reclaim.
     */
    endDropRun: () => {
      dropDepth = 0;
    },
    /** The protocols an attribute is checked against, or `undefined` when it holds no URL. */
    protocolsFor: (name: string): readonly string[] | undefined =>
      allowedProtocols[name],
  };
};
