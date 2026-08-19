/*
Fork of upstream: https://github.com/Ashish-CodeJourney/satteri-plugins/tree/main/packages/satteri-sanitize/src
Latest update: 2026-08-18 07:09 UTC with commit d13255f
Custom logic added to support more tag/attribute.
Need synced satteri v0.10 to update.
*/

import { defineHastPlugin } from "satteri";
import type { HastPluginDefinition } from "satteri";

const TAG_NAMES: readonly string[] = [
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
  "math",
  "mfrac",
  "mi",
  "mn",
  "mo",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mroot",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtext",
  "munderover",
  "munder",
  "semantics",
  "audio",
  "video",
  "abbr",
  "address",
  "bdi",
  "bdo",
  "button",
  "caption",
  "cite",
  "col",
  "colgroup",
  "figcaption",
  "figure",
  "input",
  "mark",
  "time",
  "u",
];

const DROP_CONTENT: readonly string[] = ["script"];

const GLOBAL_ATTRIBUTES: readonly string[] = [
  "dir",
  "lang",
  "title",
  "role",
  "tabindex",
  "aria-describedby",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
  "data-language",
  "data-line",
  "data-line-start",
  "data-theme",
];

const ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "name", "target", "rel", "download"],
  img: ["src", "alt", "longdesc", "height", "width", "loading", "decoding"],
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
  audio: ["controls", "loop", "muted", "preload"],
  video: [
    "controls",
    "height",
    "loop",
    "muted",
    "playsinline",
    "poster",
    "preload",
    "src",
    "width",
  ],
  button: ["disabled", "type"],
  input: ["type", "checked", "disabled"],
};

const PROTOCOLS: Readonly<Record<string, readonly string[]>> = {
  href: ["http", "https", "mailto", "xmpp", "irc", "ircs"],
  src: ["http", "https"],
  longdesc: ["http", "https"],
  cite: ["http", "https"],
};

const CLOBBER: readonly string[] = ["id", "name"];

const CLOBBER_PREFIX = "user-content-";

const CLASS_PREFIXES: readonly string[] = ["language-", "math"];

type Tag = {
  readonly kind: "tag";
  readonly name: string;
  readonly closing: boolean;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
};

type Token = Tag | { readonly kind: "text"; readonly value: string };

const ESCAPES: Record<string, string> = {
  "&": "&#x26;",
  "<": "&#x3C;",
  ">": "&#x3E;",
  '"': "&#x22;",
  "'": "&#x27;",
};

const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);/y;

const escapePreservingEntities = (value: string): string => {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";

    if (character === "&") {
      ENTITY.lastIndex = index;
      const entity = ENTITY.exec(value);
      if (entity) {
        output += entity[0];
        index = ENTITY.lastIndex - 1;
        continue;
      }
    }

    output += ESCAPES[character] ?? character;
  }

  return output;
};

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const COMMENT = /<!--[\s\S]*?-->/y;
const DOCTYPE_OR_PI = /<[!?][^>]*>/y;
const ATTRIBUTE =
  /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const parseAttributes = (source: string): Array<readonly [string, string]> => {
  const attributes: Array<readonly [string, string]> = [];
  ATTRIBUTE.lastIndex = 0;

  for (
    let match = ATTRIBUTE.exec(source);
    match;
    match = ATTRIBUTE.exec(source)
  ) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    if (name === undefined) continue;
    attributes.push([name, doubleQuoted ?? singleQuoted ?? unquoted ?? ""]);
  }

  return attributes;
};

const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let text = "";
  let index = 0;

  const flush = () => {
    if (text !== "") tokens.push({ kind: "text", value: text });
    text = "";
  };

  while (index < html.length) {
    if (html[index] !== "<") {
      text += html[index];
      index += 1;
      continue;
    }

    COMMENT.lastIndex = index;
    const comment = COMMENT.exec(html);
    if (comment) {
      flush();
      index = COMMENT.lastIndex;
      continue;
    }

    TAG.lastIndex = index;
    const tag = TAG.exec(html);
    if (tag) {
      flush();
      const [, closing, name = "", body = ""] = tag;
      tokens.push({
        kind: "tag",
        name: name.toLowerCase(),
        closing: closing === "/",
        attributes: parseAttributes(body),
      });
      index = TAG.lastIndex;
      continue;
    }

    DOCTYPE_OR_PI.lastIndex = index;
    const other = DOCTYPE_OR_PI.exec(html);
    if (other) {
      flush();
      index = DOCTYPE_OR_PI.lastIndex;
      continue;
    }

    text += "<";
    index += 1;
  }

  flush();
  return tokens;
};

const serializeTag = (
  tag: Tag,
  attributes: ReadonlyArray<readonly [string, string]>,
): string => {
  if (tag.closing) return `</${tag.name}>`;

  const rendered = attributes
    .map(([name, value]) => ` ${name}="${escapePreservingEntities(value)}"`)
    .join("");

  return `<${tag.name}${rendered}>`;
};

const NAMED_ENTITIES: Record<string, string> = {
  colon: ":",
  sol: "/",
  quest: "?",
  num: "#",
  comma: ",",
  semi: ";",
  plus: "+",
  equals: "=",
  ast: "*",
  percent: "%",
  amp: "&",
  tab: "\t",
  NewLine: "\n",
  lpar: "(",
  rpar: ")",
  period: ".",
};

const ENTITY_REF = /&#(\d+);|&#x([0-9a-f]+);|&([a-zA-Z]+);/gi;

const MAX_CODE_POINT = 0x10ffff;

const decodeEntities = (value: string): string =>
  value.replace(
    ENTITY_REF,
    (
      match,
      decimal: string | undefined,
      hex: string | undefined,
      named: string | undefined,
    ) => {
      if (named !== undefined) {
        return NAMED_ENTITIES[named] ?? match;
      }
      const code =
        decimal === undefined
          ? Number.parseInt(hex ?? "", 16)
          : Number(decimal);
      if (!Number.isInteger(code) || code < 0 || code > MAX_CODE_POINT)
        return match;
      return String.fromCodePoint(code);
    },
  );

const stripIgnored = (value: string): string => value.replace(/[\0- ]/g, "");

const isAllowedUrl = (value: string, protocols: readonly string[]): boolean => {
  const normalized = stripIgnored(decodeEntities(value));
  const colon = normalized.indexOf(":");
  if (colon === -1) return true;

  const beforeColon = normalized.slice(0, colon);
  if (/[/?#]/.test(beforeColon)) return true;

  return protocols.includes(beforeColon.toLowerCase());
};

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

const isEventHandler = (name: string): boolean => /^on[a-z]/i.test(name);

const keptClasses = (value: string): string =>
  value
    .split(/\s+/)
    .filter((token) =>
      CLASS_PREFIXES.some((prefix) => token.startsWith(prefix)),
    )
    .join(" ");

export default function satteriSanitize({
  tagNames = TAG_NAMES,
  attributes = {},
}: {
  tagNames?: readonly string[];
  attributes?: Readonly<Record<string, readonly string[]>>;
} = {}): HastPluginDefinition {
  const allowedTags = new Set(tagNames.map((name) => name.toLowerCase()));
  const mergedAttributes: Record<string, readonly string[]> = {
    ...ATTRIBUTES,
    ...attributes,
  };

  const listed = (tagName: string, name: string): boolean => {
    const list = mergedAttributes[tagName] ?? [];
    if (name !== "class" && name !== "className")
      return list.includes(name) || list.includes("className");
    return list.includes("class") || list.includes("className");
  };

  const attributeAllowed = (tagName: string, name: string): boolean =>
    GLOBAL_ATTRIBUTES.includes(name) ||
    CLOBBER.includes(name) ||
    listed(tagName, name);

  const classIsCallerConfigured = (tagName: string): boolean => {
    const list = attributes[tagName] ?? [];
    return list.includes("class") || list.includes("className");
  };

  const cleanValue = (name: string, value: string): string | undefined => {
    const allowed = PROTOCOLS[name];
    if (allowed !== undefined && !isAllowedUrl(value, allowed))
      return undefined;
    if (CLOBBER.includes(name)) return CLOBBER_PREFIX + value;
    return value;
  };

  const cleanAttributes = (tag: Tag): Array<readonly [string, string]> => {
    const kept: Array<readonly [string, string]> = [];

    for (const [rawName, value] of tag.attributes) {
      const name = rawName.toLowerCase();
      if (isEventHandler(name)) continue;
      if (!attributeAllowed(tag.name, name)) continue;

      if (name === "class" && !classIsCallerConfigured(tag.name)) {
        const classes = keptClasses(value);
        if (classes !== "") kept.push([name, classes]);
        continue;
      }

      const cleaned = cleanValue(name, value);
      if (cleaned !== undefined) kept.push([name, cleaned]);
    }

    return kept;
  };

  let dropDepth = 0;

  const sanitizeRaw = (html: string): string => {
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

  return defineHastPlugin({
    name: "satteri-sanitize",
    raw(node, ctx) {
      const sanitized = sanitizeRaw(node.value);
      if (sanitized === node.value) return;
      if (sanitized === "") {
        ctx.removeNode(node);
        return;
      }
      return { type: "raw", value: sanitized };
    },
    text(node, ctx) {
      if (dropDepth > 0) ctx.removeNode(node);
    },
    element: {
      filter: ["a", "img", ...BLOCK_ELEMENTS],
      visit(node, ctx) {
        if (BLOCK_ELEMENTS.includes(node.tagName)) dropDepth = 0;

        for (const name of ["href", "src"]) {
          const value = node.properties?.[name];
          const allowed = PROTOCOLS[name];
          if (typeof value !== "string" || allowed === undefined) continue;
          if (!isAllowedUrl(value, allowed))
            ctx.setProperty(node, name, undefined);
        }
      },
    },
  });
}
