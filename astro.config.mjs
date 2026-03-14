// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

import expressiveCode from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
  site: "https://astro.amia.work",
  integrations: [sitemap(), expressiveCode({ themes: ["github-dark"] })],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["node:fs/promises", "node:path", "node:url", "node:crypto"],
    },
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Shippori Mincho",
      cssVariable: "--font-mincho",
      subsets: ["japanese", "latin"],
      weights: [400, 700],
    },
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1 Code",
      cssVariable: "--font-code",
      subsets: ["japanese", "latin"],
    },
  ],
});
