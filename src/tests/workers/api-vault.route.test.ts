import { beforeEach, expect, describe, it } from "vitest";
import { env } from "cloudflare:workers";
import { GET } from "../../pages/api/vault/[...key]";
import { signAssetUrl } from "../../lib/vault";

const TEST_SIGNING_SECRET = "unit-test-signing-secret-0123456789abcdef";
const SLUG = "demo";
const KEY = `${SLUG}/photo.png`;
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type SessionLike = { get(key: "user_id"): Promise<string | undefined> };

function makeSession(userId?: string): SessionLike {
  return { get: async () => userId };
}

function callGet(
  key: string,
  search = "",
  session: SessionLike = makeSession("user-1"),
) {
  const url = new URL(`https://amia.work/api/vault/${key}${search}`);
  return GET({
    params: { key },
    url,
    session: session as never,
    clientAddress: "203.0.113.9",
  } as unknown as Parameters<typeof GET>[0]);
}

async function seed(): Promise<void> {
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS vault (slug TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS unlocks (user_id TEXT NOT NULL, slug TEXT NOT NULL, unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER NOT NULL, PRIMARY KEY (user_id, slug));`,
  );
  await env.DB.exec(`DELETE FROM unlocks;`);
  await env.DB.exec(
    `INSERT INTO unlocks (user_id, slug, unlocked_at, expires_at) VALUES ('user-1', '${SLUG}', unixepoch(), unixepoch() + 3600);`,
  );
  await env.VAULT_BUCKET.put(`assets/${KEY}`, PNG_BYTES);
}

async function signedSearch(
  key: string,
  secret = TEST_SIGNING_SECRET,
  atOffsetSeconds = 0,
): Promise<string> {
  const realNow = Date.now;
  try {
    if (atOffsetSeconds !== 0) {
      Date.now = () => realNow() + atOffsetSeconds * 1000;
    }
    const url = await signAssetUrl(key, secret);
    return url.slice(url.indexOf("?"));
  } finally {
    Date.now = realNow;
  }
}

describe("GET /api/vault/[key]", () => {
  beforeEach(async () => {
    await seed();
  });

  it("serves a signed asset to an unlocked user", async () => {
    const res = await callGet(KEY, await signedSearch(KEY));
    expect(res.status).toBe(200);
    expect(await res.arrayBuffer()).toEqual(PNG_BYTES.buffer);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBeNull();
    expect(res.headers.get("Referrer-Policy")).toBeNull();
  });

  it("404s unsafe keys before touching auth or storage", async () => {
    const res = await callGet("../escape.png");
    expect(res.status).toBe(404);
  });

  it("404s disallowed extensions regardless of signature state", async () => {
    const res = await callGet(`${SLUG}/payload.exe`);
    expect(res.status).toBe(404);
  });

  it("403s missing signatures", async () => {
    const res = await callGet(KEY);
    expect(res.status).toBe(403);
  });

  it("403s expired signatures", async () => {
    const search = await signedSearch(KEY, TEST_SIGNING_SECRET, -400);
    const res = await callGet(KEY, search);
    expect(res.status).toBe(403);
  });

  it("403s tampered signatures", async () => {
    const search = await signedSearch(KEY);
    const params = new URLSearchParams(search);
    const sig = params.get("sig")!;
    params.set("sig", (sig.startsWith("A") ? "B" : "A") + sig.slice(1));
    const res = await callGet(KEY, `?${params.toString()}`);
    expect(res.status).toBe(403);
  });

  it("403s signatures minted under a different secret", async () => {
    const search = await signedSearch(
      KEY,
      "other-signing-secret-0123456789abcd",
    );
    const res = await callGet(KEY, search);
    expect(res.status).toBe(403);
  });

  it("403s locked users even with a valid signature", async () => {
    const res = await callGet(
      KEY,
      await signedSearch(KEY),
      makeSession(undefined),
    );
    expect(res.status).toBe(403);
  });

  it("403s users without an unlock row for the slug", async () => {
    await env.DB.exec(
      `INSERT INTO unlocks (user_id, slug, unlocked_at, expires_at) VALUES ('user-2', 'other-slug', unixepoch(), unixepoch() + 3600);`,
    );
    const res = await callGet(
      KEY,
      await signedSearch(KEY),
      makeSession("user-2"),
    );
    expect(res.status).toBe(403);
  });

  it("honours expired unlock rows", async () => {
    await env.DB.exec(
      `UPDATE unlocks SET expires_at = unixepoch() - 1 WHERE user_id = 'user-1';`,
    );
    const res = await callGet(KEY, await signedSearch(KEY));
    expect(res.status).toBe(403);
  });
});
