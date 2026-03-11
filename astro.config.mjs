// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://astro.amia.work",
  output: "server",
  integrations: [sitemap()],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["node:fs/promises", "node:path", "node:url", "node:crypto"],
    },
  },
});
