export const ENVELOPE_PREFIX = "data";
export const R2_PREFIX = "assets";

const UNLOCK_TTL_SECONDS = 7776000;

const ASSET_URL_TTL_SECONDS = 300;

export interface VaultEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  VAULT_BUCKET: R2Bucket;
  JWT_SECRET: SecretsStoreSecret;
  JWT_AUDIENCE: SecretsStoreSecret;
  TURNSTILE_SECRET: SecretsStoreSecret;
  VAULT_SIGNING_SECRET: SecretsStoreSecret;
  VERIFY_PATH: SecretsStoreSecret;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function hmacSha256(
  secret: string,
  message: string,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

export async function signAssetUrl(
  key: string,
  secret: string,
  ttlSeconds = ASSET_URL_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = base64UrlEncode(
    new Uint8Array(await hmacSha256(secret, `${exp}.${key}`)),
  );
  return `/api/vault/${key}?exp=${exp}&sig=${sig}`;
}

export async function verifySignedAsset(
  key: string,
  expRaw: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  if (!/^\d+$/.test(expRaw) || !sig) return false;
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now || exp - now > ASSET_URL_TTL_SECONDS) return false;
  const expected = base64UrlEncode(
    new Uint8Array(await hmacSha256(secret, `${exp}.${key}`)),
  );
  return timingSafeEqual(expected, sig);
}

export async function signAssetUrlsInHtml(
  html: string,
  secret: string,
): Promise<string> {
  const parts = html.split(/(\/api\/vault\/[^\s"'`<>?]+)/g);
  const signed = await Promise.all(
    parts.map((part) =>
      part.startsWith("/api/vault/")
        ? signAssetUrl(part.slice("/api/vault/".length), secret)
        : part,
    ),
  );
  return signed.join("");
}

export async function mintVerifyJwt(
  secret: string,
  sub: string,
  audience: string,
  issuer: string,
  ttlSeconds = 60,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: issuer,
    aud: audience,
    sub,
    iat: now,
    exp: now + ttlSeconds,
  };
  const head = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = base64UrlEncode(
    new Uint8Array(await hmacSha256(secret, `${head}.${body}`)),
  );
  return `${head}.${body}.${sig}`;
}

export interface VerifyPasswordResult {
  ok: boolean;
  verified: boolean;
  error?: string;
}

export async function verifyPasswordWithRemote(
  input: string,
  targetHash: string,
  env: VaultEnv,
  slug: string,
  issuer: string,
): Promise<VerifyPasswordResult> {
  const jwtSecret = await env.JWT_SECRET.get();
  if (!jwtSecret) return { ok: false, verified: false, error: "server_error" };

  const jwtAudience = await env.JWT_AUDIENCE.get();
  if (!jwtAudience) {
    return { ok: false, verified: false, error: "server_error" };
  }

  const verifyPath = await env.VERIFY_PATH.get();
  if (!verifyPath) {
    return { ok: false, verified: false, error: "server_error" };
  }
  const verifyEndpoint = `${jwtAudience}${verifyPath}`;

  let token: string;
  try {
    token = await mintVerifyJwt(jwtSecret, slug, jwtAudience, issuer);
  } catch {
    return { ok: false, verified: false, error: "server_error" };
  }

  let response: Response;
  try {
    response = await fetch(verifyEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input, target: targetHash }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, verified: false, error: "upstream_error" };
  }

  if (!response.ok) {
    return { ok: false, verified: false, error: "upstream_error" };
  }

  let body: { success?: boolean };
  try {
    body = (await response.json()) as { success?: boolean };
  } catch {
    return { ok: false, verified: false, error: "upstream_error" };
  }
  return { ok: true, verified: body?.success === true };
}

const EXPECTED_ACTION = "vault-login";

export async function verifyTurnstile(
  token: string,
  clientAddress: string,
  secret: string,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;

  let result: {
    success?: boolean;
    action?: string;
  };
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: clientAddress,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return false;
    result = (await response.json()) as {
      success?: boolean;
      action?: string;
    };
  } catch {
    return false;
  }

  return result.success === true && result.action === EXPECTED_ACTION;
}

export async function getVaultHash(
  env: VaultEnv,
  slug: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT password_hash FROM vault WHERE slug = ?",
  )
    .bind(slug)
    .first<{ password_hash: string }>();
  return row?.password_hash ?? null;
}

export async function isUnlocked(
  env: VaultEnv,
  userId: string,
  slug: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 FROM unlocks WHERE user_id = ? AND slug = ? AND expires_at > unixepoch()",
  )
    .bind(userId, slug)
    .first();
  return row != null;
}

export async function recordUnlock(
  env: VaultEnv,
  userId: string,
  slug: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO unlocks (user_id, slug, unlocked_at, expires_at)
     VALUES (?, ?, unixepoch(), unixepoch() + ?)
     ON CONFLICT(user_id, slug)
     DO UPDATE SET unlocked_at = unixepoch(), expires_at = unixepoch() + ?`,
  )
    .bind(userId, slug, UNLOCK_TTL_SECONDS, UNLOCK_TTL_SECONDS)
    .run();
}

export async function cleanupExpiredUnlocks(env: VaultEnv): Promise<number> {
  const result = await env.DB.prepare(
    "DELETE FROM unlocks WHERE expires_at < unixepoch()",
  ).run();
  return result.meta.changes ?? 0;
}
