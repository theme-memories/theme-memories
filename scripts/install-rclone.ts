import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const URL = "https://downloads.rclone.org/rclone-current-linux-amd64.zip";
const BIN_NAME = "rclone";
const INSTALL_DIR = join(ROOT, ".tools", "rclone");
const BIN_PATH = join(INSTALL_DIR, BIN_NAME);

function main(): void {
  const extractDir = join(tmpdir(), `rclone-extract-${process.pid}`);
  const zipPath = join(tmpdir(), `rclone-${process.pid}.zip`);
  mkdirSync(extractDir, { recursive: true });

  try {
    console.log(`downloading ${URL}`);
    execFileSync("wget", ["-q", "-O", zipPath, URL], { stdio: "inherit" });
    console.log(`downloaded ${URL.split("/").pop()}`);
    execFileSync(
      "unzip",
      ["-o", "-j", zipPath, `*/${BIN_NAME}`, "-d", extractDir],
      {
        stdio: "inherit",
      },
    );
  } finally {
    rmSync(zipPath, { force: true });
  }

  const extracted = join(extractDir, BIN_NAME);
  if (!existsSync(extracted)) {
    throw new Error(`could not find ${BIN_NAME} in the archive`);
  }

  mkdirSync(INSTALL_DIR, { recursive: true });
  copyFileSync(extracted, BIN_PATH);
  chmodSync(BIN_PATH, 0o755);
  console.log(`installed rclone at ${BIN_PATH}`);

  rmSync(extractDir, { recursive: true, force: true });
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
