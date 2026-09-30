import { describe, expect, it } from "vitest";
import { renderKatexError } from "../src/mdast/katex-html";

describe("renderKatexError", () => {
  it("echoes the failing source with the parse error in a tooltip", () => {
    expect(
      renderKatexError("\\frac{a}", "KaTeX parse error: Expected '}'"),
    ).toBe(
      '<span class="katex-error" title="KaTeX parse error: Expected &#x27;}&#x27;" ' +
        'style="color:#cc0000">\\frac{a}</span>',
    );
  });

  it("escapes the source so a failing expression cannot inject markup", () => {
    const html = renderKatexError("<img src=x onerror=alert(1)>", "boom");

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes the message so it cannot break out of the title attribute", () => {
    const html = renderKatexError("x", 'bad " quote & <tag>');

    expect(html).toContain('title="bad &quot; quote &amp; &lt;tag&gt;"');
  });
});
