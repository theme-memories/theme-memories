// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

import expressiveCode from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
  site: "https://astro.amia.work",
  output: "server",
  integrations: [sitemap(), expressiveCode({ themes: ["github-dark"] })],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["node:fs/promises", "node:path", "node:url", "node:crypto"],
    },
  },
});
