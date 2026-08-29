// Thin wrapper around the `wrangler` CLI used by post-upload.ts.
//
// Resolution order: pnpm > local node_modules bin > PATH. An ENOENT on one
// candidate falls through to the next, so the script works in both local (pnpm)
// and CI setups. With captureStdout it returns stdout as a string.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "../config.ts";

export function runWrangler(args: string[], captureStdout = false): string {
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
