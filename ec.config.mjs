import { defineEcConfig } from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";

export default defineEcConfig({
  themes: ["catppuccin-latte"],
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
  styleOverrides: {
    codeFontFamily: "var(--font-mpc), var(--font-noto-emoji), monospace",
    uiFontFamily: "var(--font-mp), var(--font-noto-emoji), monospace",
  },
});
