import katex from "katex";
import { defineMdastPlugin } from "satteri";
import { renderKatexError } from "./katex-html";

/*
 * Sätteri parses `$…$` and `$$…$$` but renders nothing, so TeX otherwise
 * reaches the page as a `language-math` code block. Rendering happens here, on
 * MDAST, rather than on HAST: Astro's syntax highlighter is registered ahead of
 * user HAST plugins and would claim display math as a plaintext code block
 * before a HAST plugin ever saw it.
 */
const render = (source: string, displayMode: boolean) => {
  try {
    return {
      type: "html" as const,
      value: katex.renderToString(source, { displayMode, throwOnError: true }),
    };
  } catch (error) {
    // A malformed expression is one authoring mistake; the rest of the
    // document should still build.
    return { type: "html" as const, value: renderKatexError(source, error) };
  }
};

export const mdastKatexPlugin = defineMdastPlugin({
  name: "mdast-katex",
  math: (node) => render(node.value, true),
  inlineMath: (node) => render(node.value, false),
});
