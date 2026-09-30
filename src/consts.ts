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
