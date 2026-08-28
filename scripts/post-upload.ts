import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  ARGON2_OPTIONS,
  MANIFEST_PATH,
  R2_REMOTE,
  ROOT,
  STAGING_DIR,
  d1DatabaseName,
} from "./config.ts";

// --- Vault hash / D1 sync helpers (build-time only) ---

const ARGON2_PHC_PREFIX = "$argon2id$";
const MAX_TARGET_LENGTH = 128;

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

function isCanonicalBase64(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64").replace(/=+$/, "") === value;
}

function isValidArgon2Phc(target: string): boolean {
  const parts = target.split("$");
  if (parts.length !== 6) return false;

  const [, algorithm, version, rawParams, salt, digest] = parts;
  if (algorithm !== "argon2id" || !/^v=\d+$/.test(version)) return false;
  if (!isCanonicalBase64(salt) || !isCanonicalBase64(digest)) return false;

  const params = new Map<string, string>();
  for (const rawParam of rawParams.split(",")) {
    const match = /^(m|t|p)=(\d+)$/.exec(rawParam);
    if (!match || params.has(match[1])) return false;
    params.set(match[1], match[2]);
  }
  return params.size === 3;
}

async function assertPublishableHash(hash: string): Promise<void> {
  if (hash.length === 0 || hash.length > MAX_TARGET_LENGTH) {
    throw new Error(
      `passwordHash length out of bounds (expected 1..${MAX_TARGET_LENGTH}); refusing to publish`,
    );
  }
  if (!hash.startsWith(ARGON2_PHC_PREFIX) || !isValidArgon2Phc(hash)) {
    throw new Error(
      "passwordHash is not a well-formed argon2id PHC string; refusing to publish",
    );
  }
  const argon2Module = await import("argon2");
  const argon2 = ((argon2Module as { default?: unknown }).default ??
    argon2Module) as {
    needsRehash(hash: string, options: typeof ARGON2_OPTIONS): boolean;
  };
  let needsRehash: boolean;
  try {
    needsRehash = argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    throw new Error(
      "passwordHash failed argon2 validation; refusing to publish",
    );
  }
  if (needsRehash) {
    throw new Error(
      "passwordHash needs rehash (cost parameters differ from the verifier's " +
        "expected argon2id parameters); refusing to publish",
    );
  }
}

const quote = (value: string): string => `'${value}'`;

const upsertHash = (slug: string, hash: string): string =>
  `INSERT INTO vault (slug, password_hash, updated_at) VALUES (${quote(slug)}, ${quote(hash)}, unixepoch()) ON CONFLICT(slug) DO UPDATE SET password_hash = excluded.password_hash, updated_at = unixepoch();`;

const VAULT_SYNC_CHUNK_SIZE = 100;
const MAX_COMMAND_BYTES = 96 * 1024;

function buildVaultSyncCommands(
  current: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, string>,
  chunkSize: number = VAULT_SYNC_CHUNK_SIZE,
): string[] {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error(`invalid vault sync chunk size: ${chunkSize}`);
  }

  const commands: string[] = [];
  let batch: string[] = [];
  const flush = (): void => {
    if (batch.length > 0) {
      commands.push(batch.join("\n"));
      batch = [];
    }
  };

  for (const [slug, hash] of current) {
    if (!SLUG_RE.test(slug)) {
      throw new Error(`invalid vault slug: ${slug}`);
    }
    if (existing.get(slug) === hash) continue;
    batch.push(
      `DELETE FROM unlocks WHERE slug = ${quote(slug)};`,
      upsertHash(slug, hash),
    );
    if (batch.length >= chunkSize * 2) flush();
  }
  flush();

  if (current.size > 0) {
    const slugList = [...current.keys()].map(quote).join(", ");
    commands.push(
      `DELETE FROM vault WHERE slug NOT IN (${slugList});\nDELETE FROM unlocks WHERE slug NOT IN (${slugList});`,
    );
  } else {
    commands.push("DELETE FROM unlocks;\nDELETE FROM vault;");
  }

  for (const command of commands) {
    if (Buffer.byteLength(command, "utf8") > MAX_COMMAND_BYTES) {
      throw new Error(
        `vault sync command is ${Buffer.byteLength(command)} bytes, exceeding ` +
          `the safe --command size (${MAX_COMMAND_BYTES}); lower the chunk size`,
      );
    }
  }
  return commands;
}

function parseVaultRows(stdout: string): Map<string, string> {
  const parsed: unknown = JSON.parse(stdout);
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  const rows: unknown[] = blocks.flatMap((block) => {
    const results = (block as { results?: unknown })?.results;
    return Array.isArray(results) ? results : [];
  });

  const existing = new Map<string, string>();
  for (const row of rows) {
    const slug = (row as { slug?: unknown })?.slug;
    const hash = (row as { password_hash?: unknown })?.password_hash;
    if (typeof slug !== "string" || typeof hash !== "string") continue;
    if (!SLUG_RE.test(slug)) continue;
    existing.set(slug, hash);
  }
  return existing;
}

// --- Wrangler / rclone configuration ---

const productionDatabaseName = d1DatabaseName;

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

interface PrepareManifest {
  slugs: string[];
  hashes: Record<string, string>;
}

function readManifest(): PrepareManifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      "no prepare manifest found; run `publish-prepare` before `publish-upload`",
    );
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as PrepareManifest;
}

async function runUpload(): Promise<void> {
  const manifest = readManifest();

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

  try {
    if (!rcloneReady) {
      throw new Error(
        "rclone R2 not fully configured (CLOUDFLARE_ACCOUNT_ID + access key + secret required); " +
          "aborting to prevent D1 advertising posts without uploaded assets",
      );
    }
    console.log(`rclone sync ${STAGING_DIR} -> ${R2_REMOTE}`);
    runRclone(
      [
        "sync",
        STAGING_DIR,
        R2_REMOTE,
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

    runWrangler([
      "d1",
      "migrations",
      "apply",
      productionDatabaseName,
      "--remote",
    ]);
    console.log("applied pending D1 migrations");

    const current = new Map(Object.entries(manifest.hashes));

    const reused = [...current.entries()].find(([slug, hash]) =>
      [...current.entries()].some(
        ([otherSlug, otherHash]) => otherHash === hash && otherSlug !== slug,
      ),
    );
    if (reused) {
      const reusedBy = [...current.entries()]
        .filter(([, hash]) => hash === reused[1])
        .map(([s]) => s);
      throw new Error(
        `password hash is reused by ${reusedBy.join(" and ")}; rotate each vault password before production publish`,
      );
    }

    for (const hash of current.values()) {
      await assertPublishableHash(hash);
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

    const commands = buildVaultSyncCommands(current, existing);
    for (let i = 0; i < commands.length; i += 1) {
      const sql = commands[i]!;
      runWrangler([
        "d1",
        "execute",
        productionDatabaseName,
        "--remote",
        "--command",
        sql,
      ]);
      console.log(
        `applied vault sync ${i + 1}/${commands.length} (${Buffer.byteLength(sql)} bytes)`,
      );
    }
    console.log(
      `upserted ${current.size} hashes (unlock revocations limited to changed slugs), cleaned stale rows`,
    );
  } finally {
    rmSync(STAGING_DIR, { recursive: true, force: true });
    rmSync(MANIFEST_PATH, { force: true });
  }
}

runUpload().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
