import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { R2_PREFIX, verifySignedAsset } from "../../../lib/vault";

export const prerender = false;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
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
const MAX_KEY_LENGTH = 256;
const MAX_SVG_SIZE = 1_048_576;

function sanitizeSvg(source: string): string {
  let svg = source;
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  svg = svg.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  svg = svg.replace(/<object[\s\S]*?<\/object>/gi, "");
  svg = svg.replace(/<embed[\s\S]*?\/?>/gi, "");
  svg = svg.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  svg = svg.replace(/\bon\w+\s*=\s*[^\s>]+/gi, "");
  svg = svg.replace(
    /<use[^>]*href\s*=\s*(?:"[^"]*:[^"]*"|'[^']*:[^']*')[^>]*\/?>/gi,
    "",
  );
  svg = svg.replace(
    /<use[^>]*xlink:href\s*=\s*(?:"[^"]*:[^"]*"|'[^']*:[^']*')[^>]*\/?>/gi,
    "",
  );
  return svg;
}

export const GET: APIRoute = async ({ params, url }) => {
  const key = params.key ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (
    key.length > MAX_KEY_LENGTH ||
    key.includes("..") ||
    key.split("").some((c) => c.charCodeAt(0) < 0x20)
  ) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
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
    secret = await env.VAULT_SIGNING_SECRET.get();
  } catch {
    /* secret not configured; fail closed */
  }
  if (!secret || !(await verifySignedAsset(key, exp, sig, secret))) {
    return new Response("Forbidden", {
      status: 403,
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

  if (ext === "svg") {
    const text = await object.text();
    if (text.length > MAX_SVG_SIZE) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const sanitized = sanitizeSvg(text);
    return new Response(sanitized, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
};
