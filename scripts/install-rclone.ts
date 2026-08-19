import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RCLONE_VERSION = "1.75.0";
const PINNED_ZIP_SHA256 =
  "aa2804e08f48250e71009c727124b6341cd0288465804a9a09d14663cabafbaa";

const ZIP_NAME = `rclone-v${RCLONE_VERSION}-linux-amd64.zip`;
const DOWNLOAD_URL = `https://github.com/rclone/rclone/releases/download/v${RCLONE_VERSION}/${ZIP_NAME}`;
const SUMS_URL = `https://github.com/rclone/rclone/releases/download/v${RCLONE_VERSION}/SHA256SUMS`;
const BIN_NAME = "rclone";
const INSTALL_DIR = join(ROOT, ".tools", "rclone");
const BIN_PATH = join(INSTALL_DIR, BIN_NAME);

function sha256File(path: string): string {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function fetchExpectedSha256(sumsPath: string): string {
  const lines = readFileSync(sumsPath, "utf8").split("\n");
  for (const line of lines) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === ZIP_NAME && hash) return hash;
  }
  throw new Error(`could not find ${ZIP_NAME} in SHA256SUMS`);
}

function main(): void {
  const tempDir = mkdtempSync(join(tmpdir(), "rclone-install-"));
  const extractDir = join(tempDir, "extract");
  const zipPath = join(tempDir, ZIP_NAME);
  const sumsPath = join(tempDir, "SHA256SUMS");
  mkdirSync(extractDir);

  try {
    console.log(`downloading ${DOWNLOAD_URL}`);
    execFileSync("wget", ["-q", "-O", zipPath, DOWNLOAD_URL], {
      stdio: "inherit",
    });
    console.log(`downloaded ${ZIP_NAME}`);

    console.log(`downloading SHA256SUMS`);
    execFileSync("wget", ["-q", "-O", sumsPath, SUMS_URL], {
      stdio: "inherit",
    });

    const expected = fetchExpectedSha256(sumsPath);
    if (expected !== PINNED_ZIP_SHA256) {
      throw new Error(
        `reviewed checksum does not match release checksum for ${ZIP_NAME}`,
      );
    }
    const actual = sha256File(zipPath);
    if (actual !== PINNED_ZIP_SHA256) {
      throw new Error(`SHA-256 mismatch: expected ${expected}, got ${actual}`);
    }
    console.log("checksum verified");

    execFileSync(
      "unzip",
      ["-o", "-j", zipPath, `*/${BIN_NAME}`, "-d", extractDir],
      { stdio: "inherit" },
    );
    const extracted = join(extractDir, BIN_NAME);
    if (!existsSync(extracted)) {
      throw new Error(`could not find ${BIN_NAME} in the archive`);
    }

    mkdirSync(INSTALL_DIR, { recursive: true });
    copyFileSync(extracted, BIN_PATH);
    chmodSync(BIN_PATH, 0o755);
    console.log(`installed rclone v${RCLONE_VERSION} at ${BIN_PATH}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
