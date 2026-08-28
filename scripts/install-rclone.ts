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
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  RCLONE_BINARY_NAME,
  RCLONE_BINARY_PATH,
  RCLONE_INSTALL_DIR,
  RCLONE_PINNED_CHECKSUM,
  RCLONE_VERSION,
} from "./config.ts";

const ZIP_FILE_NAME = `rclone-v${RCLONE_VERSION}-linux-amd64.zip`;
const ZIP_DOWNLOAD_URL = `https://github.com/rclone/rclone/releases/download/v${RCLONE_VERSION}/${ZIP_FILE_NAME}`;
const CHECKSUMS_URL = `https://github.com/rclone/rclone/releases/download/v${RCLONE_VERSION}/SHA256SUMS`;

function computeSha256(path: string): string {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function readChecksumFromSumsFile(sumsPath: string): string {
  const lines = readFileSync(sumsPath, "utf8").split("\n");
  for (const line of lines) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === ZIP_FILE_NAME && hash) return hash;
  }
  throw new Error(`could not find ${ZIP_FILE_NAME} in SHA256SUMS`);
}

function downloadFile(url: string, dest: string): void {
  console.log(`downloading ${url}`);
  execFileSync("wget", ["-q", "-O", dest, url], { stdio: "inherit" });
}

function installRclone(): void {
  const workDir = mkdtempSync(join(tmpdir(), "rclone-install-"));
  const extractDir = join(workDir, "extract");
  const downloadedZipPath = join(workDir, ZIP_FILE_NAME);
  const downloadedSumsPath = join(workDir, "SHA256SUMS");
  mkdirSync(extractDir);

  try {
    downloadFile(ZIP_DOWNLOAD_URL, downloadedZipPath);
    console.log(`downloaded ${ZIP_FILE_NAME}`);

    downloadFile(CHECKSUMS_URL, downloadedSumsPath);

    const publishedChecksum = readChecksumFromSumsFile(downloadedSumsPath);
    if (publishedChecksum !== RCLONE_PINNED_CHECKSUM) {
      throw new Error(
        `release checksum does not match pinned checksum for ${ZIP_FILE_NAME}`,
      );
    }

    const downloadedChecksum = computeSha256(downloadedZipPath);
    if (downloadedChecksum !== RCLONE_PINNED_CHECKSUM) {
      throw new Error(
        `SHA-256 mismatch: expected ${RCLONE_PINNED_CHECKSUM}, got ${downloadedChecksum}`,
      );
    }
    console.log("checksum verified");

    execFileSync(
      "unzip",
      [
        "-o",
        "-j",
        downloadedZipPath,
        `*/${RCLONE_BINARY_NAME}`,
        "-d",
        extractDir,
      ],
      { stdio: "inherit" },
    );
    const extractedBinary = join(extractDir, RCLONE_BINARY_NAME);
    if (!existsSync(extractedBinary)) {
      throw new Error(`could not find ${RCLONE_BINARY_NAME} in the archive`);
    }

    mkdirSync(RCLONE_INSTALL_DIR, { recursive: true });
    copyFileSync(extractedBinary, RCLONE_BINARY_PATH);
    chmodSync(RCLONE_BINARY_PATH, 0o755);
    console.log(`installed rclone v${RCLONE_VERSION} at ${RCLONE_BINARY_PATH}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  installRclone();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
