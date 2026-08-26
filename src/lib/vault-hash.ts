export const ARGON2_PHC_PREFIX = "$argon2id$";
export const MAX_TARGET_LENGTH = 128;
export const EXPECTED_ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

export function isCanonicalBase64(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64").replace(/=+$/, "") === value;
}

export function isValidArgon2Phc(target: string): boolean {
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
    needsRehash(hash: string, options: typeof EXPECTED_ARGON2): boolean;
  };
  let needsRehash: boolean;
  try {
    needsRehash = argon2.needsRehash(hash, EXPECTED_ARGON2);
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

export function buildVaultSyncSql(
  current: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [];

  for (const [slug, hash] of current) {
    if (!SLUG_RE.test(slug)) {
      throw new Error(`invalid vault slug: ${slug}`);
    }
    if (existing.get(slug) === hash) continue;
    lines.push(`DELETE FROM unlocks WHERE slug = ${quote(slug)};`);
    lines.push(upsertHash(slug, hash));
  }

  if (current.size > 0) {
    const slugList = [...current.keys()].map(quote).join(", ");
    lines.push(`DELETE FROM vault WHERE slug NOT IN (${slugList});`);
    lines.push(`DELETE FROM unlocks WHERE slug NOT IN (${slugList});`);
  } else {
    lines.push("DELETE FROM unlocks;");
    lines.push("DELETE FROM vault;");
  }

  return lines;
}

export function parseVaultRows(stdout: string): Map<string, string> {
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
