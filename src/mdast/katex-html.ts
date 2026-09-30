const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ESCAPES[character]);

/*
 * KaTeX ships no error styling of its own. A failing expression is echoed back
 * as escaped source so the author can see it, with the parse error in a
 * tooltip — never as markup it could inject.
 */
export const renderKatexError = (source: string, error: unknown): string =>
  `<span class="katex-error" title="${escapeHtml(String(error))}" ` +
  `style="color:#cc0000">${escapeHtml(source)}</span>`;
