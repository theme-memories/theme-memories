import { describe, expect, it } from "vitest";
import { allowRequest } from "../src/utils/rate-limit";

const createLimiter = (success: boolean) => {
  const keys: string[] = [];

  const limiter = {
    limit: async ({ key }: { key: string }) => {
      keys.push(key);
      return { success };
    },
  } as unknown as RateLimit;

  return { limiter, keys };
};

describe("allowRequest", () => {
  it("passes the key through and allows a permitted request", async () => {
    const { limiter, keys } = createLimiter(true);

    await expect(allowRequest(limiter, "203.0.113.7")).resolves.toBe(true);
    expect(keys).toEqual(["203.0.113.7"]);
  });

  it("is false when the limiter refuses", async () => {
    const { limiter } = createLimiter(false);

    await expect(allowRequest(limiter, "first-post")).resolves.toBe(false);
  });
});
