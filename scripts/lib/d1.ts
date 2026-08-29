import { runWrangler } from "./wrangler.ts";

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;
const VAULT_SYNC_CHUNK_SIZE = 100;
const MAX_COMMAND_BYTES = 96 * 1024;

const quote = (value: string): string => `'${value}'`;

const upsertHash = (slug: string, hash: string): string =>
  `INSERT INTO vault (slug, password_hash, updated_at) VALUES (${quote(slug)}, ${quote(hash)}, unixepoch()) ON CONFLICT(slug) DO UPDATE SET password_hash = excluded.password_hash, updated_at = unixepoch();`;

function buildStaleCleanup(current: ReadonlyMap<string, string>): string {
  if (current.size === 0) {
    return "DELETE FROM unlocks;\nDELETE FROM vault;";
  }
  const slugList = [...current.keys()].map(quote).join(", ");
  return (
    `DELETE FROM vault WHERE slug NOT IN (${slugList});\n` +
    `DELETE FROM unlocks WHERE slug NOT IN (${slugList});`
  );
}

export function buildVaultSyncCommands(
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

  commands.push(buildStaleCleanup(current));

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

export function readExistingVaultRows(database: string): Map<string, string> {
  const stdout = runWrangler(
    [
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      "--command",
      "SELECT slug, password_hash FROM vault",
    ],
    true,
  );
  return parseVaultRows(stdout);
}
