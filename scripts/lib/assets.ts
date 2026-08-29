import { existsSync, statSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { isSafeAssetKey } from "../../src/lib/vault.ts";
import { VAULT_DIR } from "../config.ts";

// Resolve a vault asset reference against the vault root. Returns the
// deployable R2 key (relative path) when the reference points at a real file
// inside VAULT_DIR, or null for external/absolute URLs and missing files.
// NOTE: references are resolved from VAULT_DIR, not the post's subdirectory,
// so content must link assets using vault-root-relative paths.
export function isLocalFile(normalized: string): string | null {
  const resolved = resolve(VAULT_DIR, normalized);
  if (!resolved.startsWith(VAULT_DIR + sep)) return null;
  if (!existsSync(resolved)) return null;
  const stat = statSync(resolved);
  if (!stat.isFile()) return null;
  const real = realpathSync(resolved);
  const realRoot = realpathSync(VAULT_DIR);
  if (!real.startsWith(realRoot + sep)) return null;
  return relative(VAULT_DIR, resolved).split(sep).join("/");
}

export interface CollectedAssets {
  html: string;
  assets: Map<string, string>;
}

// Rewrite local vault asset URLs in rendered HTML to `/api/vault/...` paths and
// collect the referenced source files for staging. External, anchor, data:, and
// already-rewritten `/api/` URLs are left untouched; the /api/vault URLs are signed
// at request time by src/lib/vault.ts (signAssetUrlsInHtml).
export function collectAssets(fragment: string, slug: string): CollectedAssets {
  const assets = new Map<string, string>();
  const registerLocalAsset = (value: string): string => {
    const withoutQuery = value.split(/[?#]/)[0] ?? "";
    if (!withoutQuery) return value;
    const r2Key = isLocalFile(withoutQuery);
    if (!r2Key) return value;
    if (!isSafeAssetKey(r2Key)) {
      throw new Error(
        `${slug}: asset name not deployable: ${r2Key} — rename using only [A-Za-z0-9._-]`,
      );
    }
    const source = join(VAULT_DIR, ...r2Key.split("/"));
    assets.set(r2Key, source);
    return `/api/vault/${r2Key}`;
  };

  const urlAttr = /((?:src|href|poster|data-src)=)("([^"]*)"|'([^']*)')/g;
  let html = fragment.replace(
    urlAttr,
    (full, prefix: string, _q: string, dq: string, sq: string) => {
      const value = (dq ?? sq ?? "").trim();
      if (!value) return full;
      if (
        /^(https?:)?\/\//.test(value) ||
        value.startsWith("/api/") ||
        value.startsWith("#") ||
        value.startsWith("data:") ||
        value.startsWith("mailto:")
      ) {
        return full;
      }
      return `${prefix}"${registerLocalAsset(value)}"`;
    },
  );

  const srcsetAttr = /srcset=("([^"]*)"|'([^']*)')/g;
  html = html.replace(
    srcsetAttr,
    (_full, _q: string, dq: string, sq: string) => {
      const value = dq ?? sq ?? "";
      const candidates = value.split(",").map((c) => c.trim());
      const rewritten = candidates.map((candidate) => {
        const [url, descriptor] = candidate.split(/\s+/, 2);
        if (!url) return candidate;
        const rewrittenUrl = registerLocalAsset(url);
        if (rewrittenUrl === url) return candidate;
        return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
      });
      return `srcset="${rewritten.join(", ")}"`;
    },
  );

  return { html, assets };
}
