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
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'",
        "frame-src https://challenges.cloudflare.com",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", "https://challenges.cloudflare.com"],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
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
      path: "/",
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
      provider: fontProviders.google(),
      name: "M PLUS 1",
      cssVariable: "--font-mpone",
      subsets: ["latin", "latin-ext"],
      weights: ["400 700"],
    },
    {
      provider: fontProviders.google(),
      name: "M PLUS 1 Code",
      cssVariable: "--font-mpone-code",
      subsets: ["latin", "latin-ext"],
      weights: ["400 700"],
      fallbacks: ["monospace"],
    },
    {
      provider: fontProviders.googleicons(),
      name: "Material Symbols Outlined",
      cssVariable: "--font-ms-outlined",
      options: {
        experimental: {
          glyphs: [
            "add",
            "play_arrow",
            "close",
            "info",
            "lightbulb",
            "priority_high",
            "warning_amber",
            "error",
          ],
        },
      },
    },
    {
      provider: fontProviders.google(),
      name: "Noto Color Emoji",
      cssVariable: "--font-noto-emoji",
    },
  ],
  vite: {
    build: {
      minify: false,
    },
    plugins: [tailwindcss()],
  },
});
