export const UNLOCK_TTL_SECONDS = 259_200;

export const isUnlocked = async (
  db: D1Database,
  userid: string,
  slug: string,
  nowSeconds: number,
): Promise<boolean> => {
  const row = await db
    .prepare(
      "SELECT 1 FROM unlock WHERE userid = ?1 AND slug = ?2 AND expireTime > ?3 LIMIT 1",
    )
    .bind(userid, slug, nowSeconds)
    .first();

  return row !== null;
};

export const storeUnlock = async (
  db: D1Database,
  userid: string,
  slug: string,
  nowSeconds: number,
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO unlock (userid, slug, authedTime, expireTime) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(userid, slug) DO UPDATE SET authedTime = excluded.authedTime, expireTime = excluded.expireTime`,
    )
    .bind(userid, slug, nowSeconds, nowSeconds + UNLOCK_TTL_SECONDS)
    .run();
};
