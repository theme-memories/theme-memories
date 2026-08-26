import { describe, expect, it } from "vitest";
import { markdownToHtml } from "satteri";
import satteriSanitize from "../../lib/satteri-sanitize";
import { katex } from "../../lib/satteri-katex";

async function render(markdown: string): Promise<string> {
  const { html } = await markdownToHtml(markdown, {
    features: { gfm: true, math: true },
    mdastPlugins: [katex()],
    hastPlugins: [satteriSanitize()],
  });
  return html;
}

describe("satteriSanitize", () => {
  it("keeps GFM column alignment styles on table cells", async () => {
    const html = await render(
      `| L | C | R |\n| :-- | :-: | --: |\n| a | b | c |`,
    );
    expect(html).toContain('<th style="text-align: left">L</th>');
    expect(html).toContain('<th style="text-align: center">C</th>');
    expect(html).toContain('<th style="text-align: right">R</th>');
    expect(html).toContain('<td style="text-align: left">a</td>');
  });

  it("strips non-alignment inline styles everywhere", async () => {
    const html = await render(
      `| X |\n| --- |\n| <span style="position:fixed">cell</span> |`,
    );
    expect(html).not.toContain("position");
    expect(html).toContain("<span>cell</span>");
  });

  it("rejects multi-declaration or hostile style values even on cells", async () => {
    const html = await render(
      `| X |\n| --- |\n| <td style="text-align:center;background:url(x)">v</td> |`,
    );
    expect(html).not.toContain("background");
  });

  it("still strips event handlers and javascript: URLs", async () => {
    const html = await render(
      `<a href="javascript:alert(1)" onclick="x()">k</a><script>1</script>`,
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
  });

  it("preserves KaTeX output untouched", async () => {
    const html = await render("$$E=mc^2$$");
    expect(html).toContain('class="katex');
    expect(html).toContain("style=");
  });
});
