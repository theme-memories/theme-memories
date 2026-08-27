import type { VaultEnv } from "../lib/vault";
import { logEvent, logError } from "./shared";

export async function cleanupExpiredUnlocks(
  vaultEnv: VaultEnv,
): Promise<number> {
  const deleteResult = await vaultEnv.DB.prepare(
    "DELETE FROM unlocks WHERE expires_at < unixepoch()",
  ).run();
  return deleteResult.meta.changes ?? 0;
}

export async function runUnlockCleanup(vaultEnv: VaultEnv): Promise<void> {
  try {
    const removedUnlockCount = await cleanupExpiredUnlocks(vaultEnv);
    logEvent("vault_unlock_cleanup_ok", { removed: removedUnlockCount });
  } catch (error) {
    logError("vault_unlock_cleanup_failed", error);
    throw error;
  }
}
