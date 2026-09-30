/*
 * Vendored from `satteri-sanitize` (satteri-plugins), MIT © Ashish Vaghela —
 * https://github.com/Ashish-CodeJourney/satteri-plugins/tree/main/packages/satteri-sanitize
 */

/**
 * URL protocol checking.
 *
 * The attacks this defends against are all about disguising the protocol:
 * casing (`JaVaScRiPt:`), character entities (`java&#115;cript:`), and control
 * characters or whitespace inside the scheme (`java\tscript:`). Browsers strip
 * all of those before dispatching, so the check has to strip them too.
 */

/** Map of named HTML entities that could be used to bypass URL protocol checks. */
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

const ENTITY = /&#(\d+);|&#x([0-9a-f]+);|&([a-zA-Z]+);/gi;

/** The largest code point Unicode defines; `String.fromCodePoint` throws above it. */
const MAX_CODE_POINT = 0x10ffff;

const decodeEntities = (value: string): string =>
  value.replace(
    ENTITY,
    (
      match,
      decimal: string | undefined,
      hex: string | undefined,
      named: string | undefined,
    ) => {
      // HTML's named character references are case-sensitive, so a name outside
      // this map is one no browser would decode either.
      if (named !== undefined) {
        return NAMED_ENTITIES[named] ?? match;
      }

      const code =
        decimal === undefined
          ? Number.parseInt(hex ?? "", 16)
          : Number(decimal);

      // A reference outside the Unicode range is not a character, so it is left
      // as written. Testing `Number.isFinite` alone is not enough: 0xFFFFFFFF is
      // perfectly finite and still makes `fromCodePoint` throw, which would abort
      // the whole compile on a document nobody vetted.
      if (!Number.isInteger(code) || code < 0 || code > MAX_CODE_POINT) {
        return match;
      }

      return String.fromCodePoint(code);
    },
  );

/**
 * Control characters and whitespace are ignored by browsers inside a scheme.
 *
 * The range covers C0 plus space, and DEL for the same reason. Stripping more
 * than a browser does can only turn a disguised protocol into one that is
 * recognised and then rejected, never the other way round.
 */
const stripIgnored = (value: string): string =>
  // eslint-disable-next-line no-control-regex -- the control range is the point
  value.replace(/[\u0000-\u0020\u007f]/g, "");

/**
 * True when the URL's protocol is allowed. A URL with no protocol at all —
 * relative, anchor, or protocol-relative — is always allowed, matching
 * `hast-util-sanitize`.
 */
export const isAllowedUrl = (
  value: string,
  protocols: readonly string[],
): boolean => {
  const normalized = stripIgnored(decodeEntities(value));
  const colon = normalized.indexOf(":");
  if (colon === -1) return true;

  const beforeColon = normalized.slice(0, colon);

  // `/`, `?` and `#` before the colon mean the colon is part of a path or
  // query, not a scheme: `/a:b` is a relative URL.
  if (/[/?#]/.test(beforeColon)) return true;

  return protocols.includes(beforeColon.toLowerCase());
};
