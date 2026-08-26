import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { load as loadYaml } from "js-yaml";
import { parse as parseJsonc } from "jsonc-parser";
import { markdownToHtml } from "satteri";
import type { Frontmatter } from "satteri";
import expressiveCode from "satteri-expressive-code";
import type { SatteriExpressiveCodeOptions } from "satteri-expressive-code";
import { satteriPangu } from "../src/lib/satteri-pangu.ts";
import { sectionize } from "../src/lib/satteri-sectionize.ts";
import { katex } from "../src/lib/satteri-katex.ts";
import satteriDirective from "../src/lib/satteri-directive.ts";
import { satteriGithubAlerts } from "../src/lib/satteri-github-alerts.ts";
import satteriSanitize from "../src/lib/satteri-sanitize.ts";
import { satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import ecConfig from "../ec.config.mjs";
import { vault as vaultConfig } from "../src/config.ts";
import { ENVELOPE_PREFIX } from "../src/lib/vault.ts";
import {
  assertPublishableHash,
  buildVaultSyncSql,
  parseVaultRows,
} from "../src/lib/vault-hash.ts";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

const WRANGLER_CONFIG_PATH = join(ROOT, "wrangler.jsonc");
const R2_BINDING = "VAULT_BUCKET";
const D1_BINDING = "DB";

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

const VAULT_DIR = join(ROOT, "src", "content", "vault");
const STUB_DIR = join(ROOT, "src", "content", "vault-json");
const STAGING_DIR = join(ROOT, ".vault-staging");
const r2BucketName = wranglerConfig?.r2_buckets?.find(
  (bucket) => bucket.binding === R2_BINDING,
)?.bucket_name;
const d1DatabaseName = wranglerConfig?.d1_databases?.find(
  (db) => db.binding === D1_BINDING,
)?.database_name;
if (!r2BucketName || !d1DatabaseName) {
  throw new Error(
    `wrangler.jsonc must declare ${R2_BINDING} and ${D1_BINDING}; refusing to use fallback production resources`,
  );
}
const productionDatabaseName = d1DatabaseName;
const R2_REMOTE = `r2:${r2BucketName}`;

const publishProduction = process.argv.includes("--publish-prod");
const stubsOnly = process.argv.includes("--stubs-only") || !publishProduction;
if (publishProduction && process.argv.includes("--stubs-only")) {
  throw new Error("choose either --stubs-only or --publish-prod, not both");
}

function runWrangler(args: string[], captureStdout = false): string {
  const localBin = join(ROOT, "node_modules", ".bin", "wrangler");
  const candidates = [
    { command: "pnpm", args: ["wrangler", ...args] },
    { command: localBin, args },
    { command: "wrangler", args },
  ];
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate.command, candidate.args, {
        stdio: captureStdout ? ["ignore", "pipe", "inherit"] : "inherit",
        encoding: captureStdout ? "utf8" : undefined,
      }) as string;
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!missing) throw error;
    }
  }
  throw new Error(
    "wrangler not found: run `pnpm install` (installs the devDependency) or add it to PATH",
  );
}

function runRclone(args: string[], env: Record<string, string> = {}): void {
  const localBin = join(ROOT, ".tools", "rclone", "rclone");
  if (!existsSync(localBin)) {
    throw new Error(
      `rclone not installed at ${localBin}; run \`pnpm install:rclone\` first`,
    );
  }
  execFileSync(localBin, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

interface VaultFrontmatter {
  slug: string;
  title: string;
  publishedAt: string;
  displayDate?: string;
  category: string;
  thumb?: string;
  description: string;
  pinned?: boolean;
  draft?: boolean;
  protected?: boolean;
  question?: string;
  passwordHash: string;
}

const FEATURES = {
  gfm: {
    footnotes: {
      label: "注釈",
      backContent: "↑",
      backLabel: "注釈{reference}に戻る",
    },
  },
  math: true,
  directive: true,
  definitionList: true,
  smartPunctuation: true,
} as const;

const isLocalFile = (normalized: string): string | null => {
  const resolved = resolve(VAULT_DIR, normalized);
  if (!resolved.startsWith(VAULT_DIR + sep)) return null;
  if (!existsSync(resolved)) return null;
  const stat = statSync(resolved);
  if (!stat.isFile()) return null;
  const real = realpathSync(resolved);
  const realRoot = realpathSync(VAULT_DIR);
  if (!real.startsWith(realRoot + sep)) return null;
  return relative(VAULT_DIR, resolved).split(sep).join("/");
};

function parseFrontmatter(frontmatter: Frontmatter | null): VaultFrontmatter {
  if (!frontmatter || frontmatter.kind !== "yaml") {
    throw new Error("missing YAML frontmatter block");
  }
  const data = loadYaml(frontmatter.value) as VaultFrontmatter;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter block did not parse to an object");
  }
  return data;
}

async function renderFragment(
  source: string,
  fileURL: URL,
): Promise<{
  html: string;
  headings: Array<{ depth: number; slug: string; text: string }>;
  frontmatter: Frontmatter | null;
}> {
  const { html: raw, frontmatter } = await markdownToHtml(source, {
    mdastPlugins: [satteriPangu(), sectionize(), katex(), satteriDirective()],
    hastPlugins: [
      satteriGithubAlerts(),
      satteriHeadingIdsPlugin(),
      satteriSanitize(),
      expressiveCode(ecConfig as SatteriExpressiveCodeOptions),
    ],
    features: FEATURES,
    fileURL,
  });

  const html = raw;

  const headings: Array<{ depth: number; slug: string; text: string }> = [];
  const headingRe = /<h([1-6]) id="([^"]*)"[^>]*>([^<]*)<\/h\1>/g;
  for (const match of html.matchAll(headingRe)) {
    const depth = Number(match[1]);
    const slug = match[2];
    const text = match[3];
    if (depth && slug) headings.push({ depth, slug, text });
  }

  return { html, headings, frontmatter };
}

async function renderQuestionHtml(question: string): Promise<string> {
  const { html } = await markdownToHtml(question.trim(), {
    mdastPlugins: [satteriPangu(), sectionize(), katex(), satteriDirective()],
    hastPlugins: [
      satteriGithubAlerts(),
      satteriHeadingIdsPlugin(),
      satteriSanitize(),
      expressiveCode(ecConfig as SatteriExpressiveCodeOptions),
    ],
    features: FEATURES,
  });
  return html;
}

function collectAssets(fragment: string): {
  html: string;
  assets: Map<string, string>;
} {
  const assets = new Map<string, string>();
  const add = (value: string): string => {
    const withoutQuery = value.split(/[?#]/)[0] ?? "";
    if (!withoutQuery) return value;
    const r2Key = isLocalFile(withoutQuery);
    if (!r2Key) return value;
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
      return `${prefix}"${add(value)}"`;
    },
  );

  const srcsetAttr = /srcset=("([^"]*)"|'([^']*)')/g;
  html = html.replace(
    srcsetAttr,
    (full, _q: string, dq: string, sq: string) => {
      const value = dq ?? sq ?? "";
      const candidates = value.split(",").map((c) => c.trim());
      const rewritten = candidates.map((candidate) => {
        const [url, descriptor] = candidate.split(/\s+/, 2);
        if (!url) return candidate;
        const rewrittenUrl = add(url);
        if (rewrittenUrl === url) return candidate;
        return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
      });
      return full.replace(value, rewritten.join(", "));
    },
  );

  return { html, assets };
}

async function main() {
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true, mode: 0o700 });
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });

  try {
    if (!existsSync(VAULT_DIR)) {
      throw new Error(
        "src/content/vault is missing; refusing to publish or delete remote vault data",
      );
    }

    const stagedAssets = new Map<string, string>();
    const envelopes = new Map<
      string,
      { html: string; headings: unknown[]; frontmatter: unknown }
    >();
    const hashes = new Map<string, string>();
    const stubs: Array<Record<string, unknown>> = [];

    const entries = readdirSync(VAULT_DIR).filter((name) =>
      existsSync(join(VAULT_DIR, name, "index.md")),
    );
    entries.sort();

    for (const entry of entries) {
      const slug = entry;
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        throw new Error(`invalid vault slug: ${entry}`);
      }

      const source = readFileSync(join(VAULT_DIR, slug, "index.md"), "utf8");
      const { html, headings, frontmatter } = await renderFragment(
        source,
        pathToFileURL(join(VAULT_DIR, slug, "index.md")),
      );

      let fm: VaultFrontmatter;
      try {
        fm = parseFrontmatter(frontmatter);
      } catch (error) {
        throw new Error(`${entry}: ${(error as Error).message}`, {
          cause: error,
        });
      }

      if (fm.draft === true) {
        console.log(`skip ${entry}: draft`);
        continue;
      }

      const violations: string[] = [];
      if (fm.pinned === true) violations.push(`"pinned" must not be true`);
      if (fm.protected === false) violations.push(`"protected" must be true`);
      if ("password" in fm)
        violations.push(
          `"password" is no longer allowed; use "passwordHash" instead`,
        );
      if (!fm.passwordHash?.trim())
        violations.push(`"passwordHash" is required`);
      if (fm.slug !== slug)
        violations.push(`"slug" must match the directory name`);
      if (!fm.title?.trim()) violations.push(`"title" is required`);
      if (!fm.description?.trim()) violations.push(`"description" is required`);
      if (violations.length > 0) {
        throw new Error(
          `${entry}: invalid vault frontmatter:\n  - ${violations.join("\n  - ")}`,
        );
      }

      const { html: withAssets, assets } = collectAssets(html);
      for (const [key, sourcePath] of assets) stagedAssets.set(key, sourcePath);

      const questionHtml = await renderQuestionHtml(
        fm.question?.trim() || vaultConfig.genericQuestion,
      );

      const thumb =
        fm.thumb?.replace(/^\.\//, "").replace(/^\//, "") || undefined;
      if (thumb) {
        const r2Key = isLocalFile(thumb);
        if (r2Key) {
          stagedAssets.set(r2Key, join(VAULT_DIR, ...r2Key.split("/")));
        } else {
          console.warn(`skip ${entry}: thumb asset missing: ${thumb}`);
        }
      }

      envelopes.set(slug, {
        html: withAssets,
        headings,
        frontmatter: {
          slug,
          title: fm.title,
          publishedAt: fm.publishedAt,
          displayDate: fm.displayDate,
          category: fm.category,
          thumb,
          description: fm.description,
        },
      });

      const stub: Record<string, unknown> = {
        slug,
        publishedAt: fm.publishedAt,
        category: fm.category,
      };
      if (fm.displayDate) stub.displayDate = fm.displayDate;
      if (questionHtml) stub.questionHtml = questionHtml;
      stubs.push(stub);

      if (stubsOnly) {
        console.log(`prepared ${slug} (stubs-only, no hash)`);
      } else {
        const duplicate = [...hashes.entries()].find(
          ([, existingHash]) => existingHash === fm.passwordHash,
        );
        if (duplicate) {
          throw new Error(
            `password hash is reused by ${duplicate[0]} and ${slug}; rotate each vault password before production publish`,
          );
        }
        hashes.set(slug, fm.passwordHash);
        console.log(`prepared ${slug} with hash`);
      }
    }

    if (envelopes.size === 0) {
      console.log(
        stubsOnly
          ? "no vault posts to prepare"
          : "no vault posts to publish; production mode will clear remote vault data",
      );
    }

    for (const [key, sourcePath] of stagedAssets) {
      const dest = join(STAGING_DIR, "assets", ...key.split("/"));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(sourcePath, dest);
      chmodSync(dest, 0o600);
    }
    for (const [slug, envelope] of envelopes) {
      const dest = join(STAGING_DIR, ENVELOPE_PREFIX, `${slug}.json`);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, JSON.stringify(envelope), { mode: 0o600 });
    }
    console.log(
      `staged ${stagedAssets.size} assets + ${envelopes.size} envelopes in ${STAGING_DIR}`,
    );

    for (const stub of stubs) {
      writeFileSync(join(STUB_DIR, `${stub.slug}.json`), JSON.stringify(stub), {
        mode: 0o644,
      });
    }
    console.log(`wrote ${stubs.length} stubs to ${STUB_DIR}`);

    if (stubsOnly) {
      return;
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
      throw new Error(
        "CLOUDFLARE_ACCOUNT_ID is required for R2 publishing (set it in CI/CD or export it locally)",
      );
    }
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    const r2Config = {
      type: "s3",
      provider: "Cloudflare",
      accessKeyId: process.env.RCLONE_CONFIG_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.RCLONE_CONFIG_R2_SECRET_ACCESS_KEY,
      endpoint: r2Endpoint,
      acl: "private",
      noCheckBucket: false,
    };
    const rcloneReady =
      Boolean(r2Config.accessKeyId) && Boolean(r2Config.secretAccessKey);

    const destination = R2_REMOTE;
    if (rcloneReady) {
      console.log(`rclone sync ${STAGING_DIR} -> ${destination}`);
      runRclone(
        [
          "sync",
          STAGING_DIR,
          destination,
          "--checksum",
          "--fast-list",
          "--transfers",
          "16",
          "--checkers",
          "16",
        ],
        {
          RCLONE_CONFIG_R2_TYPE: r2Config.type,
          RCLONE_CONFIG_R2_PROVIDER: r2Config.provider,
          RCLONE_CONFIG_R2_ACCESS_KEY_ID: r2Config.accessKeyId!,
          RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: r2Config.secretAccessKey!,
          RCLONE_CONFIG_R2_ENDPOINT: r2Config.endpoint,
          RCLONE_CONFIG_R2_ACL: r2Config.acl,
          RCLONE_CONFIG_R2_NO_CHECK_BUCKET: r2Config.noCheckBucket
            ? "true"
            : "false",
        },
      );
    } else {
      if (!stubsOnly) {
        throw new Error(
          "rclone R2 not fully configured (CLOUDFLARE_ACCOUNT_ID + access key + secret required); " +
            "aborting to prevent D1 advertising posts without uploaded assets " +
            "(use --stubs-only for local development)",
        );
      }
      console.warn(
        "rclone R2 not fully configured; skipping R2 upload (stubs-only mode)",
      );
    }

    runWrangler([
      "d1",
      "migrations",
      "apply",
      productionDatabaseName,
      "--remote",
    ]);
    console.log("applied pending D1 migrations");

    const sqlFile = join(ROOT, `.vault-hashes-${process.pid}.sql`);
    const currentSlugs = [...hashes.keys()];

    for (const slug of currentSlugs) {
      await assertPublishableHash(hashes.get(slug)!);
    }

    let existing: Map<string, string>;
    try {
      const stdout = runWrangler(
        [
          "d1",
          "execute",
          productionDatabaseName,
          "--remote",
          "--json",
          "--command",
          "SELECT slug, password_hash FROM vault",
        ],
        true,
      );
      existing = parseVaultRows(stdout);
    } catch (error) {
      throw new Error(
        "could not read current vault hashes from D1; refusing to publish " +
          "(blanket revocation fallback is not allowed)",
        { cause: error },
      );
    }

    const lines = buildVaultSyncSql(hashes, existing);

    writeFileSync(sqlFile, lines.join("\n"), { mode: 0o600 });
    try {
      runWrangler([
        "d1",
        "execute",
        productionDatabaseName,
        "--remote",
        "--file",
        sqlFile,
      ]);
      console.log(
        `upserted ${hashes.size} hashes (unlock revocations limited to changed slugs), cleaned stale rows`,
      );
    } finally {
      rmSync(sqlFile, { force: true });
    }
  } finally {
    rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
