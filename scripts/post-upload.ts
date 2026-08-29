// Deploy step (runs via `pnpm post:upload` after `pnpm post:prepare`).
//
// Syncs .vault-staging -> the private R2 bucket, applies pending D1 migrations,
// then diff-syncs vault password hashes into D1. Order is deliberate: assets are
// uploaded BEFORE any D1 hash is advertised, so a post is never listed/unlockable
// without its assets present.
//
// HINT: `rclone sync` makes the remote match the local staging dir. If staging is
// empty (e.g. every post is a draft), the sync deletes ALL objects in the bucket
// and the D1 cleanup wipes both tables — a publish with zero posts unpublishes
// everything.
//
// Requires CLOUDFLARE_ACCOUNT_ID plus rclone R2 access key/secret in the env.
import { existsSync, readFileSync, rmSync } from "node:fs";
import {
  MANIFEST_PATH,
  R2_REMOTE,
  STAGING_DIR,
  d1DatabaseName,
} from "./config.ts";
import { buildR2Config, rcloneEnv, runRclone } from "./lib/rclone.ts";
import { runWrangler } from "./lib/wrangler.ts";
import { buildVaultSyncCommands, readExistingVaultRows } from "./lib/d1.ts";
import {
  assertPublishableHash,
  detectReusedHashes,
} from "./lib/argon2-validate.ts";

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

  const accessKeyId = process.env.RCLONE_CONFIG_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.RCLONE_CONFIG_R2_SECRET_ACCESS_KEY;
  const rcloneReady = Boolean(accessKeyId) && Boolean(secretAccessKey);
  const r2Config = buildR2Config(
    accountId,
    accessKeyId ?? "",
    secretAccessKey ?? "",
  );

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
      rcloneEnv(r2Config),
    );

    runWrangler(["d1", "migrations", "apply", d1DatabaseName, "--remote"]);
    console.log("applied pending D1 migrations");

    const currentHashes = new Map(Object.entries(manifest.hashes));

    const reusedSlugs = detectReusedHashes(currentHashes);
    if (reusedSlugs.length > 0) {
      throw new Error(
        `password hash is reused by ${reusedSlugs.join(" and ")}; rotate each vault password before production publish`,
      );
    }

    for (const hash of currentHashes.values()) {
      await assertPublishableHash(hash);
    }

    let existingHashes: Map<string, string>;
    try {
      existingHashes = readExistingVaultRows(d1DatabaseName);
    } catch (error) {
      throw new Error(
        "could not read current vault hashes from D1; refusing to publish " +
          "(blanket revocation fallback is not allowed)",
        { cause: error },
      );
    }

    const commands = buildVaultSyncCommands(currentHashes, existingHashes);
    for (let i = 0; i < commands.length; i += 1) {
      const sql = commands[i]!;
      runWrangler([
        "d1",
        "execute",
        d1DatabaseName,
        "--remote",
        "--command",
        sql,
      ]);
      console.log(
        `applied vault sync ${i + 1}/${commands.length} (${Buffer.byteLength(sql)} bytes)`,
      );
    }
    console.log(
      `upserted ${currentHashes.size} hashes (unlock revocations limited to changed slugs), cleaned stale rows`,
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
