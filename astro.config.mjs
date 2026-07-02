// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import { satteri } from "@astrojs/markdown-satteri";
import { temmlMath } from "./src/snippets/temml";

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
      mdastPlugins: [temmlMath],
    }),
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Shippori Mincho",
      weights: [400, 500, 600, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-shippori-mincho",
    },
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1 Code",
      weights: [400, 500, 600, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-m-plus-1-code",
    },
  ],
  session: {
    cookie: {
      name: "__verification_session",
      sameSite: "strict",
    },
    ttl: 86400,
  },
});
