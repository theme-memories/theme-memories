// Cron task: purge expired vault unlocks (runs daily at 00:00).
import type { VaultEnv } from "../lib/vault";
import { logEvent, logError } from "./shared";

export async function cleanupExpiredUnlocks(
  vaultEnv: VaultEnv,
): Promise<number> {
  // Durable-sql: delete every unlock row whose TTL has elapsed.
  const deleteResult = await vaultEnv.DB.prepare(
    "DELETE FROM unlocks WHERE expires_at < unixepoch()",
  ).run();
  return deleteResult.meta.changes ?? 0;
}

// Wrapper used by workers.ts: logs outcome and rethrows so the
// scheduled invocation is marked failed on error.
export async function runUnlockCleanup(vaultEnv: VaultEnv): Promise<void> {
  try {
    const removedUnlockCount = await cleanupExpiredUnlocks(vaultEnv);
    logEvent("vault_unlock_cleanup_ok", { removed: removedUnlockCount });
  } catch (error) {
    logError("vault_unlock_cleanup_failed", error);
    throw error;
  }
}
