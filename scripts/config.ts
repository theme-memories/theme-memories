import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

export const WRANGLER_CONFIG_PATH = join(ROOT, "wrangler.jsonc");
export const R2_BINDING = "VAULT_BUCKET";
export const D1_BINDING = "DB";

export const MANIFEST_PATH = join(ROOT, ".vault-manifest.json");
export const STAGING_DIR = join(ROOT, ".vault-staging");
export const VAULT_DIR = join(ROOT, "src", "content", "vault");
export const STUB_DIR = join(ROOT, "src", "content", "vault-json");

// --- rclone (install-rclone) ---

export const RCLONE_VERSION = "1.75.0";
export const RCLONE_PINNED_CHECKSUM =
  "aa2804e08f48250e71009c727124b6341cd0288465804a9a09d14663cabafbaa";
export const RCLONE_BINARY_NAME = "rclone";
export const RCLONE_INSTALL_DIR = join(ROOT, ".tools", "rclone");
export const RCLONE_BINARY_PATH = join(RCLONE_INSTALL_DIR, RCLONE_BINARY_NAME);

// --- vault post scaffolding (post-new) ---

export const VAULT_CATEGORIES = [
  "announce",
  "campaign",
  "important",
  "message",
  "other",
  "update",
] as const;

export const DEFAULT_VAULT_QUESTION =
  "この投稿を読むためのパスワードを入力してください";

export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

interface WranglerConfig {
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
  d1_databases?: Array<{ binding?: string; database_name?: string }>;
}

function readWranglerConfig(): WranglerConfig | undefined {
  try {
    return parseJsonc(
      readFileSync(WRANGLER_CONFIG_PATH, "utf8"),
    ) as WranglerConfig;
  } catch (error) {
    console.warn(`could not read ${WRANGLER_CONFIG_PATH}:`, error);
    return undefined;
  }
}

const wranglerConfig = readWranglerConfig();

const r2BucketNameRaw = wranglerConfig?.r2_buckets?.find(
  (bucket) => bucket.binding === R2_BINDING,
)?.bucket_name;
const d1DatabaseNameRaw = wranglerConfig?.d1_databases?.find(
  (db) => db.binding === D1_BINDING,
)?.database_name;
if (!r2BucketNameRaw || !d1DatabaseNameRaw) {
  throw new Error(
    `wrangler.jsonc must declare ${R2_BINDING} and ${D1_BINDING}; refusing to use fallback production resources`,
  );
}

const r2BucketName: string = r2BucketNameRaw;
const d1DatabaseName: string = d1DatabaseNameRaw;

export { ROOT, r2BucketName, d1DatabaseName };
export const R2_REMOTE = `r2:${r2BucketName}`;
