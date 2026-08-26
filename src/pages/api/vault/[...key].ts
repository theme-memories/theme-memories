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
export const GET: APIRoute = async ({
  params,
  url,
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

  const object = await env.VAULT_BUCKET.get(`${R2_PREFIX}/${key}`);
  if (!object) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
};
