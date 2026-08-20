import { handle } from "@astrojs/cloudflare/handler";
import { syncWeather } from "./lib/weather-sync";
import { cleanupExpiredUnlocks } from "./lib/vault";
import type { VaultEnv } from "./lib/vault";

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export default {
  fetch: handle,
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      case "1 0 * * *": {
        try {
          const removed = await cleanupExpiredUnlocks(env as VaultEnv);
          console.log(
            JSON.stringify({ event: "vault_unlock_cleanup_ok", removed }),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "vault_unlock_cleanup_failed",
              name: errorName(error),
            }),
          );
          throw error;
        }
        break;
      }

      case "*/10 * * * *": {
        try {
          const result = await syncWeather(env);
          console.log(JSON.stringify({ event: "weather_sync_ok", ...result }));
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "weather_sync_failed",
              name: errorName(error),
            }),
          );
        }
        break;
      }

      default:
        console.warn(
          JSON.stringify({
            event: "unknown_cron_schedule",
            cron: controller.cron,
          }),
        );
    }
  },
};
