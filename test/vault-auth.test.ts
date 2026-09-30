import { describe, expect, it } from "vitest";
import {
  UNLOCK_TTL_SECONDS,
  isUnlocked,
  storeUnlock,
} from "../src/utils/vault-auth";

type Call = { sql: string; params: unknown[] };

const createFakeDb = (firstResult: unknown) => {
  const calls: Call[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          calls.push({ sql, params });
          return {
            first: async () => firstResult,
            run: async () => ({}),
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, calls };
};

describe("isUnlocked", () => {
  it("is true when a live row exists", async () => {
    const { db } = createFakeDb({ 1: 1 });
    await expect(isUnlocked(db, "user-1", "first-post", 1000)).resolves.toBe(
      true,
    );
  });

  it("is false when no row exists", async () => {
    const { db } = createFakeDb(null);
    await expect(isUnlocked(db, "user-1", "first-post", 1000)).resolves.toBe(
      false,
    );
  });

  it("queries by userid, slug and expiry", async () => {
    const { db, calls } = createFakeDb(null);
    await isUnlocked(db, "user-1", "first-post", 1234);

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("FROM unlock");
    expect(calls[0].params).toEqual(["user-1", "first-post", 1234]);
  });
});

describe("storeUnlock", () => {
  it("upserts with an expiry of now + TTL", async () => {
    const { db, calls } = createFakeDb(null);
    await storeUnlock(db, "user-1", "first-post", 1000);

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("ON CONFLICT(userid, slug)");
    expect(calls[0].params).toEqual([
      "user-1",
      "first-post",
      1000,
      1000 + UNLOCK_TTL_SECONDS,
    ]);
  });
});
