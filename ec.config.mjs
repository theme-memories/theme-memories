import { defineEcConfig } from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";

/*
 * Kanagawa is a light/dark pair drawn from one palette, inspired by ukiyo-e
 * woodblock printing. Its colours are muted and low in saturation, which keeps a
 * code block from shouting on a page built for reading, and because both themes
 * come from the same family a block reads as one system whichever is active.
 */
export default defineEcConfig({
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
  themes: ["kanagawa-lotus", "kanagawa-wave"],
  useDarkModeMediaQuery: false,
  themeCssSelector: (theme) =>
    `[data-theme="${theme.type === "dark" ? "night" : "nord"}"]`,
  styleOverrides: {
    codeFontFamily: "var(--font-mplus-code), var(--font-emoji), monospace",
    uiFontFamily: "var(--font-mplus), var(--font-emoji), sans-serif",
    // The frame takes the page theme's own panel surface and corner radius
    // instead of the syntax theme's, so a code block belongs to the page it sits
    // in. `prose.css` points inline code at the same two tokens.
    codeBackground: "var(--color-base-200)",
    borderRadius: "var(--radius-box)",
    /*
     * The tab surface, which `codeBackground` does not reach.
     *
     * A titled frame draws its title in a tab, and the plugin resolves that
     * tab's background and label from the syntax theme: on kanagawa-lotus the
     * pair measured 3.95:1, under AA and under even the 3:1 a glyph is held to.
     * Both halves are re-pointed at the page's own tokens, so the title reads as
     * a label on the panel rather than as a surviving piece of the theme, and the
     * fix covers a tab bar with more than one tab rather than only the single
     * title the content happens to use today.
     */
    frames: {
      editorTabBarBackground: "var(--color-base-300)",
      editorActiveTabBackground: "var(--color-base-300)",
      editorActiveTabForeground: "var(--color-base-content)",
      editorTabBarForeground: "var(--color-base-content)",
    },
  },
});
