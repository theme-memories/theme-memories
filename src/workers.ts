import { handle } from "@astrojs/cloudflare/handler";
import { syncWeather } from "./lib/weather-sync";
import { cleanupExpiredUnlocks } from "./lib/vault";
import type { VaultEnv } from "./lib/vault";

export default {
  fetch: handle,
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      case "1 0 * * *": {
        try {
          const removed = await cleanupExpiredUnlocks(env as VaultEnv);
          console.log("vault unlock cleanup ok", removed);
        } catch (error) {
          console.error("vault unlock cleanup failed", error);
          throw error;
        }
        break;
      }

      case "*/10 * * * *": {
        try {
          const result = await syncWeather(env);
          console.log("weather sync ok", JSON.stringify(result));
        } catch (error) {
          console.error("weather sync failed", error);
          throw error;
        }
        break;
      }

      default:
        console.warn("unknown cron schedule", controller.cron);
    }
  },
};
