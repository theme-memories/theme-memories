# AGENTS.md

Agent guidance for this repository. `CLAUDE.md` is a symlink to this file.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Use **pnpm**. Before calling a change done, run the same checks the build and hooks run:

| Command                       | What it does                                                 |
| :---------------------------- | :----------------------------------------------------------- |
| `pnpm dev`                    | Dev server at `localhost:4321`                               |
| `pnpm build`                  | `astro check` + production build to `dist/`                  |
| `pnpm preview`                | Build, then preview the built Worker                         |
| `pnpm test`                   | Vitest (`vitestconfig.ts` — not `vitest.config.*`)           |
| `pnpm cf-typegen`             | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `pnpm deploy`                 | Build, then `wrangler deploy`                                |
| `pnpm hash:vault`             | Interactive argon2id hash for vault frontmatter              |
| `pnpm exec eslint <files>`    | Lint TypeScript/JS                                           |
| `pnpm exec stylelint <files>` | Lint CSS                                                     |

Husky + lint-staged run eslint/prettier and stylelint/prettier on commit.

## What this is

_Theme Memories_ (プエラ・モギカ) — a Japanese-language blog about _Project SEKAI_ and the character 暁山 瑞希. Astro 7 + TypeScript, deployed as a Cloudflare Worker at https://amia.work.

- **All user-facing text is Japanese** — page copy, component labels, `aria-label`s, and the chrome of third-party widgets (Plyr, Swiper, PhotoSwipe, Turnstile).
- **No trailing slashes**: `trailingSlash: "never"` with `html_handling: "drop-trailing-slash"`, so hyphenated paths are served directly rather than redirected.
- Public pages are prerendered; only the gated routes are server-rendered (`login/[slug]`, `vault/[slug]`, `api/auth`).

## Repository layout

```
src/
├── consts.ts          # shared values: site meta, nav, loader URL, argon2 params
├── content.config.ts  # the two content collections and their schemas
├── markdown.ts        # the single Markdown feature/plugin set every compile shares
├── data/              # categories (source of truth) and the character profile
├── hast/              # HAST plugins + vendored HTML sanitizer (src/hast/sanitize)
├── mdast/             # MDAST plugins: KaTeX, reading time, vault question
├── components/        # .astro components
├── layouts/           # BaseLayout (chrome) and BlogPost (article shell)
├── pages/             # routes (see above for the SSR ones)
├── scripts/           # client-side progressive enhancements, dynamic-imported
├── styles/            # Tailwind v4 + daisyUI entry (global.css) and theme tokens
└── utils/             # pure helpers, unit-tested
src/content/           # git submodule: article/ + vault/ + assets/
```

Path aliases: `@components/*`, `@layouts/*`, `@utils/*`, `@assets/*`.

## Content

Two collections, both plain Markdown (GFM, no MDX), defined in `src/content.config.ts`:

- **article** — public posts.
- **vault** — password-gated posts: the same fields plus `question` and `passwordHash`.

Shared frontmatter: `slug`, `category` (`tech` / `life` / `notes`, from `src/data/categories.ts`), `title`, `description`, `pubDate`, `updatedDate?`, `heroImage?`, `pinned`, `draft`.

Rules:

- The layout owns the page `h1`; body content uses **`h2`–`h6` only**.
- Body is **GFM**. Per-post assets are co-located in `src/content/assets/<collection>/<slug>/`.
- `slug` is explicit in frontmatter and meaningful (ASCII/romaji), not derived from the filename.
- `draft: true` entries must stay excluded **everywhere** — listings, RSS, sitemap, and generated routes.
- A vault `passwordHash` must be an argon2id hash matching `VAULT_ARGON2_OPTIONS`; the schema rejects anything else. Generate one with `pnpm hash:vault`.
- `src/content` is a **git submodule**; clone with `git submodule update --init`.

## Vault authentication

`/vault/[slug]` is SSR and redirects to `/login/[slug]` unless the session's `userid` is unlocked. `POST /api/auth` runs, in order: body-size cap → per-IP rate limit → resolve the entry → Turnstile verification → per-slug rate limit → password rule → argon2 verification → session regeneration and `storeUnlock`. Unlocks persist in the D1 `unlock` table (`migrations/`) with a TTL.

- Argon2 is **not** bundled: verification is delegated over HMAC-signed HTTPS to the sibling `../argon2` service (`ARGON2_ENDPOINT`).
- Secrets come from the Cloudflare secrets store (`wrangler.jsonc`), never plaintext vars.
- Rate limits live in `wrangler.jsonc` (`ratelimits`) and in the Cloudflare dashboard.
- Security checks fail closed. Keep private routes `noindex`, out of the sitemap, and disallowed in `robots.txt`.

## Conventions

- Comments explain **why**, not what — match the existing density and tone.
- Shared values live in one source of truth (`src/consts.ts`, `src/data/*`); schemas and components derive from it.
- Every Markdown compile path goes through the shared pipeline in `src/markdown.ts`; never list plugins per call site.
- Pure helpers belong in `src/utils/` with a Vitest test under `test/`.
- Client-side behaviour lives in `src/scripts/` as one `enhanceX()` per effect, mounted by the component that needs it and guarding on its own target element. Any library it needs is pulled in with a dynamic `import()` from inside, so a page that never shows the effect never downloads it.
- Decorative motion is dropped, not shortened, under `prefers-reduced-motion: reduce`: the loader's animation and the click burst (`src/scripts/fireworks.ts`) both decline to attach at all.
- Front-end third-party assets are self-hosted (e.g. `public/plyr.svg`); rendered pages must not request third-party CDNs.
- Raw HTML is sanitized by the vendored sanitizer in `src/hast/sanitize/` (MIT, from `satteri-sanitize`).

## Sibling projects

`../cron` (the weather crawler that writes `current-weather.json`) and `../argon2` (the verification service) are separate repositories. Treat them as **read-only**: inspect them for context, never edit them from here.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
