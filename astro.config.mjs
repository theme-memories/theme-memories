// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import expressiveCode from "astro-expressive-code";

export default defineConfig({
  site: "https://amia.work",
  trailingSlash: "never",
  integrations: [sitemap(), expressiveCode({ themes: ["github-dark"] })],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Shippori Mincho",
      weights: [400, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-shippori-mincho",
    },
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1 Code",
      weights: [400, 700],
      subsets: ["latin", "latin-ext", "japanese"],
      cssVariable: "--font-m-plus-1-code",
    },
  ],
  session: {
    cookie: {
      name: "__amia_session",
      sameSite: "strict",
    },
  },
});
