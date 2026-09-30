import { describe, expect, it } from "vitest";
import { createSanitizer } from "../src/hast/sanitize/filter";
import { TAG_NAMES } from "../src/hast/sanitize/schema";
import {
  SITE_ATTRIBUTES,
  SITE_PROTOCOLS,
  SITE_TAG_NAMES,
} from "../src/hast/sanitize/site-schema";

/* The same allowlist the pipeline is configured with in `hast-sanitize.ts`. */
const sanitizeHtml = (html: string, extra = {}) =>
  createSanitizer({
    tagNames: [...TAG_NAMES, ...SITE_TAG_NAMES],
    attributes: SITE_ATTRIBUTES,
    protocols: SITE_PROTOCOLS,
    ...extra,
  }).sanitizeHtml(html);

describe("sanitizeHtml", () => {
  it("removes a script element along with its text", () => {
    expect(
      sanitizeHtml('<p>before</p><script>alert("x")</script><p>after</p>'),
    ).toBe("<p>before</p><p>after</p>");
  });

  it("fails closed on an unclosed script run", () => {
    // Nothing after an unclosed `<script>` is trusted as markup. The plugin
    // resumes at the next block element; on its own the filter drops the rest.
    expect(sanitizeHtml("<script>alert(1)")).toBe("");
    expect(sanitizeHtml("<script>alert(1)<p>after</p>")).toBe("");
  });

  it("refuses event handlers", () => {
    expect(sanitizeHtml('<img src="/a.png" onerror="alert(1)">')).toBe(
      '<img src="/a.png">',
    );
  });

  it("refuses an event handler even when the allowlist names it", () => {
    expect(
      sanitizeHtml('<a href="/x" onclick="alert(1)">x</a>', {
        attributes: { a: ["href", "onclick"] },
      }),
    ).toBe('<a href="/x">x</a>');
  });

  it("drops a javascript: URL", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("drops a URL whose protocol is disguised by case and an entity", () => {
    expect(sanitizeHtml('<a href="JaVaScRiPt&#58;alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("drops a URL whose scheme is split by a control character", () => {
    expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("keeps a relative URL", () => {
    expect(sanitizeHtml('<a href="/article/x">x</a>')).toBe(
      '<a href="/article/x">x</a>',
    );
  });

  it("resumes filtering once a block element ends a dropped run", () => {
    const sanitizer = createSanitizer({
      tagNames: [...TAG_NAMES, ...SITE_TAG_NAMES],
      attributes: SITE_ATTRIBUTES,
      protocols: SITE_PROTOCOLS,
    });

    sanitizer.sanitizeHtml("<script>");
    expect(sanitizer.dropsText()).toBe(true);

    sanitizer.endDropRun();
    expect(sanitizer.dropsText()).toBe(false);
    expect(sanitizer.sanitizeHtml("<p>after</p>")).toBe("<p>after</p>");
  });

  it("unwraps an unknown element but keeps its text", () => {
    expect(sanitizeHtml("<blink>kept</blink>")).toBe("kept");
  });

  it("drops comments", () => {
    expect(sanitizeHtml("<p>a</p><!-- hidden -->")).toBe("<p>a</p>");
  });

  it("prefixes id and name so raw HTML cannot clobber a document property", () => {
    expect(sanitizeHtml('<a id="unlock-submit" name="x">x</a>')).toBe(
      '<a id="user-content-unlock-submit" name="user-content-x">x</a>',
    );
  });

  it("keeps the media the site authors as plain HTML", () => {
    /*
     * A boolean attribute comes back with an empty value, which is how HTML5
     * writes it and what the browser and Plyr both read as "present".
     */
    expect(
      sanitizeHtml(
        '<audio controls src="https://object.amia.work/assets/refrain.mp3"></audio>',
      ),
    ).toBe(
      '<audio controls="" src="https://object.amia.work/assets/refrain.mp3"></audio>',
    );

    expect(
      sanitizeHtml(
        '<video controls playsinline src="https://object.amia.work/assets/refrain.mp4"></video>',
      ),
    ).toBe(
      '<video controls="" playsinline="" src="https://object.amia.work/assets/refrain.mp4"></video>',
    );
  });

  /*
   * `mdast-katex` emits KaTeX as raw HTML, so its MathML tree and its HTML
   * layout layer both have to come through untouched or every formula breaks.
   */
  describe("KaTeX output", () => {
    const katex =
      '<span class="katex">' +
      '<span class="katex-mathml">' +
      '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
      "<semantics><mrow><mn>2</mn><mo>+</mo><mn>2</mn></mrow>" +
      '<annotation encoding="application/x-tex">2+2</annotation>' +
      "</semantics></math></span>" +
      '<span class="katex-html" aria-hidden="true">' +
      '<span class="base"><span class="strut" style="height:0.6444em;"></span>' +
      '<span class="mord">2</span></span></span></span>';

    const sanitized = sanitizeHtml(katex);

    it("keeps the layout classes", () => {
      expect(sanitized).toContain('<span class="katex">');
      expect(sanitized).toContain('class="katex-mathml"');
      expect(sanitized).toContain('class="mord"');
    });

    it("keeps the inline lengths the layout needs", () => {
      expect(sanitized).toContain('style="height:0.6444em;"');
    });

    it("keeps the MathML tree", () => {
      expect(sanitized).toContain("<math xmlns=");
      expect(sanitized).toContain("<semantics>");
      expect(sanitized).toContain("<mn>2</mn>");
    });

    it("keeps the TeX annotation and the accessibility marker", () => {
      expect(sanitized).toContain('encoding="application/x-tex"');
      expect(sanitized).toContain('aria-hidden="true"');
    });

    /*
     * KaTeX draws a radical, a stretchy brace or a vector arrow as inline SVG.
     * Unwrapped, the drawing vanished while the space it reserved stayed, which
     * pushed the numerator of a fraction off its centre.
     */
    it("keeps the inline SVG the drawing is made of", () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="400em" height="1.08em" ' +
        'viewBox="0 0 400000 1080" preserveAspectRatio="xMinYMin slice">' +
        '<path d="M95,702"/></svg>';

      expect(sanitizeHtml(svg)).toBe(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400em" height="1.08em" ' +
          'viewBox="0 0 400000 1080" preserveAspectRatio="xMinYMin slice">' +
          '<path d="M95,702"></svg>',
      );
    });

    it("restores the camelCase SVG attribute names HTML lower-cases", () => {
      expect(
        sanitizeHtml(
          '<svg viewbox="0 0 1 1" preserveaspectratio="none"></svg>',
        ),
      ).toBe('<svg viewBox="0 0 1 1" preserveAspectRatio="none"></svg>');
    });

    it("still refuses a link or an event handler on the drawing", () => {
      expect(
        sanitizeHtml(
          '<svg><path d="M0,0" onclick="alert(1)" xlink:href="javascript:alert(1)"/></svg>',
        ),
      ).toBe('<svg><path d="M0,0"></svg>');
    });

    /*
     * The MathML half is what a screen reader reads, because the HTML layout
     * layer is `aria-hidden`. Without these the accessible tree describes less
     * than the formula says.
     */
    it("keeps the MathML presentation attributes", () => {
      const math =
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>' +
        '<mo stretchy="false" fence="true">(</mo>' +
        '<menclose notation="updiagonalstrike"><mi>x</mi></menclose>' +
        '<mi mathvariant="double-struck">R</mi>' +
        "</mrow></math>";

      const out = sanitizeHtml(math);
      expect(out).toContain('stretchy="false"');
      expect(out).toContain('fence="true"');
      expect(out).toContain('notation="updiagonalstrike"');
      expect(out).toContain('mathvariant="double-struck"');
    });
  });
});
