import { handle } from "@astrojs/cloudflare/handler";
import { runWeatherSync } from "./cron/weather";
import { runUnlockCleanup } from "./cron/cleanup";
import { warnUnknownSchedule } from "./cron/shared";
import type { VaultEnv } from "./lib/vault";

export default {
  fetch: handle,
  // Cron triggers are dispatched here by Cloudflare. Match the schedule
  // expression to its handler:
  //   "1 0 * * *"      -> daily vault unlock cleanup
  //   "*/10 * * * *"   -> weather sync every 10 minutes
  // Unknown schedules are logged and ignored (see warnUnknownSchedule).
  async scheduled(scheduledEvent: ScheduledController, env: Env) {
    switch (scheduledEvent.cron) {
      case "1 0 * * *":
        await runUnlockCleanup(env as VaultEnv);
        break;

      case "*/10 * * * *":
        await runWeatherSync(env);
        break;

      default:
        warnUnknownSchedule(scheduledEvent.cron);
    }
  },
};
