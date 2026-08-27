export const ENVELOPE_PREFIX = "data";
export const R2_PREFIX = "assets";

const UNLOCK_TTL_SECONDS = 604800;
const ASSET_URL_TTL_SECONDS = 300;
const ASSET_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}(?:\/[A-Za-z0-9._-]+)+$/;
const MAX_TARGET_LENGTH = 128;
const MAX_VERIFY_RESPONSE_BYTES = 4096;
const VERIFY_PATH_PATTERN = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

export type VaultEnv = Pick<
  Env,
  | "DB"
  | "SESSION"
  | "VAULT_BUCKET"
  | "JWT_SECRET"
  | "JWT_AUDIENCE"
  | "TURNSTILE_SECRET"
  | "VAULT_SIGNING_SECRET"
  | "VERIFY_PATH"
>;

const encoder = new TextEncoder();

export async function readSecret(
  binding: SecretsStoreSecret | string,
): Promise<string | null> {
  if (typeof binding === "string") return binding;
  try {
    return (await binding.get()) ?? null;
  } catch {
    return null;
  }
}

export function isSafeAssetKey(key: string): boolean {
  return (
    key.length <= 256 &&
    ASSET_KEY_PATTERN.test(key) &&
    key.split("/").every((segment) => segment !== "." && segment !== "..")
  );
}

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

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const digest = async (value: string): Promise<ArrayBuffer> => {
    const data = encoder.encode(value);
    return crypto.subtle.digest("SHA-256", data);
  };
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  return crypto.subtle.timingSafeEqual(left, right);
}

export async function signAssetUrl(
  key: string,
  secret: string,
  ttlSeconds = ASSET_URL_TTL_SECONDS,
): Promise<string> {
  if (!isSafeAssetKey(key)) throw new Error("invalid vault asset key");
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > ASSET_URL_TTL_SECONDS
  ) {
    throw new Error("invalid vault asset URL lifetime");
  }
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
  if (
    !isSafeAssetKey(key) ||
    !/^\d{1,12}$/.test(expRaw) ||
    !/^[-_A-Za-z0-9]{43}$/.test(sig)
  ) {
    return false;
  }
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (exp < now || exp - now > ASSET_URL_TTL_SECONDS) return false;
  const expected = base64UrlEncode(
    new Uint8Array(await hmacSha256(secret, `${exp}.${key}`)),
  );
  return await timingSafeEqual(expected, sig);
}

export async function signAssetUrlsInHtml(
  html: string,
  secret: string,
  slug?: string,
): Promise<string> {
  const parts = html.split(/(\/api\/vault\/[^\s"'`<>?]+)/g);
  const signed = await Promise.all(
    parts.map(async (part) => {
      if (!part.startsWith("/api/vault/")) return part;
      const key = part.slice("/api/vault/".length);
      if ((slug && !key.startsWith(`${slug}/`)) || !isSafeAssetKey(key)) {
        return part;
      }
      return signAssetUrl(key, secret);
    }),
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
    jti: crypto.randomUUID(),
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
  if (
    !targetHash.startsWith("$argon2id$") ||
    targetHash.length > MAX_TARGET_LENGTH
  ) {
    return { ok: false, verified: false, error: "server_error" };
  }

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
  let audienceUrl: URL;
  try {
    audienceUrl = new URL(jwtAudience);
  } catch {
    return { ok: false, verified: false, error: "server_error" };
  }
  if (audienceUrl.protocol !== "https:") {
    return { ok: false, verified: false, error: "server_error" };
  }
  if (
    audienceUrl.username ||
    audienceUrl.password ||
    audienceUrl.search ||
    audienceUrl.hash
  ) {
    return { ok: false, verified: false, error: "server_error" };
  }
  if (!VERIFY_PATH_PATTERN.test(verifyPath) || verifyPath.length > 256) {
    return { ok: false, verified: false, error: "server_error" };
  }
  const basePath = audienceUrl.pathname.replace(/\/$/, "");
  const verifyEndpoint = new URL(`${basePath}${verifyPath}`, audienceUrl.origin)
    .href;

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
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input, target: targetHash }),
      signal: AbortSignal.timeout(13_000),
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, verified: false, error: "upstream_error" };
    }
  } catch {
    return { ok: false, verified: false, error: "upstream_error" };
  }

  if (!response.ok) {
    if (response.status === 429) {
      return { ok: false, verified: false, error: "rate_limited" };
    }
    return { ok: false, verified: false, error: "upstream_error" };
  }

  const responseLength = response.headers.get("Content-Length");
  if (
    responseLength !== null &&
    (!/^\d+$/.test(responseLength) ||
      Number(responseLength) > MAX_VERIFY_RESPONSE_BYTES)
  ) {
    return { ok: false, verified: false, error: "upstream_error" };
  }

  let body: { success?: boolean };
  try {
    const text = await response.text();
    if (text.length > MAX_VERIFY_RESPONSE_BYTES) {
      return { ok: false, verified: false, error: "upstream_error" };
    }
    body = JSON.parse(text) as { success?: boolean };
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

  let result: { success?: boolean; action?: string; hostname?: string };
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
      hostname?: string;
    };
  } catch {
    return false;
  }

  return (
    result.success === true &&
    result.action === EXPECTED_ACTION &&
    result.hostname === "amia.work"
  );
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
