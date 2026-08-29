import { ARGON2_OPTIONS } from "../config.ts";

export const MAX_TARGET_LENGTH = 128;
export const ARGON2_PHC_PREFIX = "$argon2id$";

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

export async function assertPublishableHash(hash: string): Promise<void> {
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

export function detectReusedHashes(
  hashes: ReadonlyMap<string, string>,
): string[] {
  const slugsByHash = new Map<string, string[]>();
  for (const [slug, hash] of hashes) {
    const group = slugsByHash.get(hash) ?? [];
    group.push(slug);
    slugsByHash.set(hash, group);
  }
  const reused: string[] = [];
  for (const group of slugsByHash.values()) {
    if (group.length > 1) reused.push(...group);
  }
  return reused;
}
