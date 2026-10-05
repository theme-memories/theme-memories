import { defineEcConfig } from "astro-expressive-code";
import {
  pluginCollapsibleSections,
  pluginCollapsibleSectionsTexts,
} from "@expressive-code/plugin-collapsible-sections";
import { pluginFramesTexts } from "@expressive-code/plugin-frames";
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
/*
 * Expressive Code's own UI strings — the copy button, the terminal window's
 * fallback title and the "N collapsed lines" summary — are not config values:
 * each plugin keeps a `PluginTexts` singleton, so the Japanese locale is
 * registered on the two plugins that have one and `defaultLocale` selects it.
 * `addLocale` wants the plugin's full set of keys, which is why the frames trio
 * is written together.
 */
pluginFramesTexts.addLocale("ja", {
  terminalWindowFallbackTitle: "ターミナル",
  copyButtonTooltip: "コードをコピー",
  copyButtonCopied: "コピーしました",
});
pluginCollapsibleSectionsTexts.addLocale("ja", {
  collapsedLines: "{lineCount}行を省略",
});

export default defineEcConfig({
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
  defaultLocale: "ja",
  defaultProps: {
    /*
     * A terminal transcript is output, not a file, so the line-number gutter
     * annotates nothing and only adds width.
     */
    overridesByLang: {
      "bash,sh,shell,zsh,fish,console,ansi,cmd": { showLineNumbers: false },
    },
  },
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
      /*
       * No shadow. The plugin lifts the frame off the page with its own
       * `0.1rem 0.1rem 0.2rem` drop shadow, the last decorative default to
       * survive the remap: the rest of the chrome is flat, the brief refuses
       * shadows outright ("nothing casts a shadow"), and the frame already
       * separates itself by its `base-200` panel and its header bar. Removing it
       * is what makes a code block sit in the page rather than float over it.
       */
      frameBoxShadowCssValue: "none",
      editorTabBarBackground: "var(--color-base-300)",
      editorActiveTabBackground: "var(--color-base-300)",
      editorActiveTabForeground: "var(--color-base-content)",
      editorTabBarForeground: "var(--color-base-content)",
    },
  },
});
