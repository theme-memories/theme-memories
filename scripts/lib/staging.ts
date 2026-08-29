// Writes the prepare-stage outputs to disk.
//
// Modes matter: envelopes and the manifest contain secret-adjacent data (the
// manifest holds real argon2 hashes), so they are written 0600; public stubs are
// 0644 and committed into src/content/vault-json for the build.
import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ENVELOPE_PREFIX } from "../../src/lib/vault.ts";
import { MANIFEST_PATH, STAGING_DIR, STUB_DIR } from "../config.ts";

export interface VaultEnvelope {
  slug: string;
  html: string;
  headings: unknown[];
  frontmatter: {
    slug: string;
    title: string;
    publishedAt: string;
    displayDate?: string;
    category: string;
    thumb: string | undefined;
    description: string;
  };
}

export type VaultStub = Record<string, unknown>;

export function writeAssets(stagedAssets: Map<string, string>): void {
  for (const [key, sourcePath] of stagedAssets) {
    const dest = join(STAGING_DIR, "assets", ...key.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(sourcePath, dest);
    chmodSync(dest, 0o600);
  }
}

export function writeEnvelopes(envelopes: Map<string, VaultEnvelope>): void {
  for (const [slug, envelope] of envelopes) {
    const dest = join(STAGING_DIR, ENVELOPE_PREFIX, `${slug}.json`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(envelope), { mode: 0o600 });
  }
}

export function writeStubs(stubs: VaultStub[]): void {
  for (const stub of stubs) {
    writeFileSync(join(STUB_DIR, `${stub.slug}.json`), JSON.stringify(stub), {
      mode: 0o644,
    });
  }
}

export function writeManifest(
  slugs: string[],
  hashes: Map<string, string>,
): void {
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({ slugs, hashes: Object.fromEntries(hashes) }),
    { mode: 0o600 },
  );
}
