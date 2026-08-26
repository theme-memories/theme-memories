import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
  isSafeAssetKey,
  isUnlocked,
  readSecret,
  R2_PREFIX,
  verifySignedAsset,
} from "../../../lib/vault";

export const prerender = false;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json",
};

const SAFE_EXTENSIONS = new Set(Object.keys(CONTENT_TYPES));

function contentRangeValue(
  range: R2Range | undefined,
  size: number,
): string | null {
  if (!range) return null;
  const { offset, length, suffix } = range as {
    offset?: number;
    length?: number;
    suffix?: unknown;
  };
  if (typeof suffix === "number") {
    const start = Math.max(size - suffix, 0);
    const end = Math.min(suffix, size);
    return `bytes ${start}-${start + end - 1}/${size}`;
  }
  const start = typeof offset === "number" ? offset : 0;
  const remaining = size - start;
  const end = Math.min(
    typeof length === "number" ? length : remaining,
    remaining,
  );
  if (end <= 0) return null;
  return `bytes ${start}-${start + end - 1}/${size}`;
}

export const GET: APIRoute = async ({
  params,
  url,
  request,
  session,
  clientAddress,
}) => {
  const key = params.key ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!isSafeAssetKey(key)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const slash = key.indexOf("/");
  const slug = slash > 0 ? key.slice(0, slash) : "";

  if (slug) {
    try {
      const outcome = await env.VAULT_RL.limit({
        key: `${slug}:${clientAddress}`,
      });
      if (!outcome.success) {
        return new Response("Too Many Requests", {
          status: 429,
          headers: { "Cache-Control": "no-store", "Retry-After": "60" },
        });
      }
    } catch {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }
  }

  const ext = key.includes(".") ? key.split(".").pop()!.toLowerCase() : "";
  if (!SAFE_EXTENSIONS.has(ext)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let secret: string | null = null;
  try {
    secret = await readSecret(env.VAULT_SIGNING_SECRET);
  } catch {
    /* secret not configured; fail closed */
  }
  if (!secret || !(await verifySignedAsset(key, exp, sig, secret))) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let userId: string | undefined;
  try {
    userId = session ? await session.get("user_id") : undefined;
    if (!userId || !slug || !(await isUnlocked(env, userId, slug))) {
      return new Response("Forbidden", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch {
    return new Response("Vault unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const hasRange = request.headers.has("range");
  let object: R2ObjectBody | null;
  try {
    object = await env.VAULT_BUCKET.get(
      `${R2_PREFIX}/${key}`,
      hasRange ? { range: request.headers } : undefined,
    );
  } catch {
    object = await env.VAULT_BUCKET.get(`${R2_PREFIX}/${key}`);
  }
  if (!object) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });

  const range = hasRange ? contentRangeValue(object.range, object.size) : null;
  if (range) headers.set("Content-Range", range);

  return new Response(object.body, { status: range ? 206 : 200, headers });
};
