import { defineEcConfig } from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { ecThemes } from "./ec.themes.mjs";

/*
 * The four themes are authored in `ec.themes.mjs`, drawn from the same two
 * pigmented palettes as the daisyUI themes in `src/styles/global.css`, so a code
 * block belongs to the page it sits in rather than to a borrowed syntax theme.
 * The bundled Kanagawa pair this replaces was the last place a second palette
 * survived in the UI.
 *
 * `themeCssSelector` keys each theme off its own name, which is its daisyUI
 * theme name (`ai`/`kon`/`kinari`/`sumi`) that the page sets as `data-theme`.
 * Keying off the name rather than `theme.type` is what lets two light and two
 * dark themes coexist, where the old `type`-based mapping could only tell day
 * from night.
 */
export default defineEcConfig({
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
  themes: ecThemes,
  useDarkModeMediaQuery: false,
  themeCssSelector: (theme) => `[data-theme="${theme.name}"]`,
  styleOverrides: {
    codeFontFamily: "var(--font-mplus-code), var(--font-emoji), monospace",
    uiFontFamily: "var(--font-mplus), var(--font-emoji), sans-serif",
    // The frame takes the page theme's own panel surface and corner radius
    // instead of the syntax theme's, and `prose.css` points inline code at the
    // same `--color-base-200`, so both forms follow all four themes together.
    codeBackground: "var(--color-base-200)",
    borderRadius: "var(--radius-box)",
    /*
     * The tab surface, which `codeBackground` does not reach.
     *
     * A titled frame draws its title in a tab, and the plugin resolves that
     * tab's background and label from the syntax theme: on the old light theme
     * the pair measured 3.95:1, under AA and under even the 3:1 a glyph is held
     * to. Both halves are re-pointed at the page's own tokens, so the title reads
     * as a label on the panel rather than as a surviving piece of the theme, and
     * the fix covers a tab bar with more than one tab rather than only the single
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
