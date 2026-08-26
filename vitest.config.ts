import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./vitest.wrangler.jsonc" },
          }),
        ],
        test: {
          name: "workers",
          include: ["src/tests/workers/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/tests/node/**/*.test.ts"],
        },
      },
    ],
  },
});
