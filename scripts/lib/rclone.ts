// rclone wrapper for the R2 sync in post-upload.ts.
//
// The binary is installed by scripts/install-rclone.ts into .tools/rclone and is
// driven entirely via RCLONE_CONFIG_* env vars (no rclone.conf on disk).
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { RCLONE_BINARY_PATH } from "../config.ts";

export interface R2Config {
  type: string;
  provider: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  acl: string;
  noCheckBucket: boolean;
}

export function buildR2Config(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
): R2Config {
  return {
    type: "s3",
    provider: "Cloudflare",
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    acl: "private",
    noCheckBucket: false,
  };
}

export function rcloneEnv(config: R2Config): Record<string, string> {
  return {
    RCLONE_CONFIG_R2_TYPE: config.type,
    RCLONE_CONFIG_R2_PROVIDER: config.provider,
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: config.accessKeyId,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: config.secretAccessKey,
    RCLONE_CONFIG_R2_ENDPOINT: config.endpoint,
    RCLONE_CONFIG_R2_ACL: config.acl,
    RCLONE_CONFIG_R2_NO_CHECK_BUCKET: config.noCheckBucket ? "true" : "false",
  };
}

export function runRclone(
  args: string[],
  env: Record<string, string> = {},
): void {
  const localBin = RCLONE_BINARY_PATH;
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
