// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode from "astro-expressive-code";
import { satteri } from "@astrojs/markdown-satteri";
import { satteriPangu } from "./src/lib/satteri-pangu";
import { katex } from "./src/lib/satteri-katex";
import { sectionize } from "./src/lib/satteri-sectionize";
import satteriDirective from "./src/lib/satteri-directive";
import { satteriGithubAlerts } from "./src/lib/satteri-github-alerts";

// https://astro.build/config
export default defineConfig({
  site: "https://amia.work",
  trailingSlash: "never",
  adapter: cloudflare({
    imageService: {
      build: "cloudflare-binding",
      runtime: "cloudflare-binding",
    },
  }),
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/login/") &&
        !page.includes("/vault/") &&
        !page.includes("/api/"),
    }),
    expressiveCode(),
  ],
  session: {
    ttl: 2592000,
    cookie: {
      name: "__Host-amia",
      sameSite: "strict",
      maxAge: 2592000,
    },
  },
  markdown: {
    processor: satteri({
      features: {
        gfm: {
          footnotes: {
            label: "注釈",
            backContent: "↑",
            backLabel: "注釈{reference}に戻る",
          },
        },
        math: true,
        directive: true,
        smartPunctuation: true,
      },
      mdastPlugins: [satteriPangu(), sectionize(), katex(), satteriDirective()],
      hastPlugins: [satteriGithubAlerts()],
    }),
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1",
      cssVariable: "--font-mpone",
      subsets: ["latin", "latin-ext", "japanese"],
      weights: ["400", "500", "600", "700"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "M PLUS 1 Code",
      cssVariable: "--font-mpone-code",
      subsets: ["latin", "latin-ext", "japanese"],
      weights: ["400", "500", "600", "700"],
      fallbacks: ["monospace"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Material Symbols Outlined",
      cssVariable: "--font-ms-outlined",
    },
    {
      provider: fontProviders.fontsource(),
      name: "Noto Color Emoji",
      cssVariable: "--font-noto-emoji",
      subsets: ["emoji"],
    },
  ],
  vite: {
    build: {
      minify: false,
    },
    plugins: [tailwindcss()],
  },
});
