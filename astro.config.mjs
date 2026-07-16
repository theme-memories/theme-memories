// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import { satteri } from "@astrojs/markdown-satteri";
import { katex } from "./src/snippets/katex";

// https://astro.build/config
export default defineConfig({
  site: "https://amia.work",
  trailingSlash: "never",
  adapter: cloudflare({
    imageService: { build: "compile", runtime: "cloudflare-binding" },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap(), expressiveCode()],
  markdown: {
    processor: satteri({
      features: {
        math: true,
        smartPunctuation: true,
      },
      mdastPlugins: [katex],
    }),
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1",
      weights: [100, 200, 300, 400, 500, 600, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-mpone",
    },
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1 Code",
      weights: [100, 200, 300, 400, 500, 600, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-mpone-code",
    },
  ],
  session: {
    cookie: {
      name: "amia_session",
      sameSite: "strict",
    },
    ttl: 86400,
  },
});
