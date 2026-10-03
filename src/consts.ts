// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Theme Memories";
export const SITE_DESCRIPTION = "一緒に歌おう！";

/*
 * The loader animation, served from the same object storage as the weather
 * snapshot so the site keeps one origin for its runtime assets.
 *
 * The object is uploaded out of band (nothing in this repo or the `cron`
 * worker writes it), so its `Cache-Control` has to be set at upload time:
 *
 *   wrangler r2 object put object/assets/loading.json \
 *     --file <path> --content-type application/json \
 *     --cache-control "public, max-age=86400"
 */
export const LOADING_ANIMATION_URL =
  "https://object.amia.work/assets/loading.json";

export const DEFAULT_VAULT_QUESTION = "パスワードは何ですか？";

export const VAULT_ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const NAV_ITEMS = [
  { href: "/", label: "Home", match: ["/"] },
  { href: "/posts", label: "Posts", match: ["/posts", "/article"] },
  { href: "/about", label: "About", match: ["/about"] },
] as const;

/*
 * The two palettes, and the daisyUI theme each one resolves to per mode.
 *
 * Each palette is a light/dark pair drawn from one set of pigments, so the
 * switch changes the light level rather than the identity. `ai` is 藍, the cool
 * indigo pair (aizome paper by day, a deep 紺 night); `shu` is 朱, the warm
 * washi pair (生成 paper by day, a 墨 night) built around the vermilion seal.
 *
 * The theme names here are the ones declared in `src/styles/global.css` and
 * mirrored by the Expressive Code themes in `ec.themes.mjs`; a rename has to
 * reach all three. This list is what the pre-paint script and the palette
 * switch both read, so the two can never disagree about which themes exist.
 */
export const THEMES = [
  { id: "ai", label: "藍", light: "ai", dark: "kon" },
  { id: "shu", label: "朱", light: "kinari", dark: "sumi" },
] as const;

export type ThemePaletteId = (typeof THEMES)[number]["id"];
export type ThemeMode = "light" | "dark";
