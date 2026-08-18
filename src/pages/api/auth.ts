import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
  getVaultHash,
  recordUnlock,
  verifyPasswordWithRemote,
  verifyTurnstile,
} from "../../lib/vault";

export const prerender = false;

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_INPUT_LENGTH = 1024;
const MAX_BODY_BYTES = 8192;

const JSON_RESPONSE = {
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
} as const;

function jsonErr(errcode: string, status: number) {
  return Response.json(
    { success: false, errcode },
    { status, headers: JSON_RESPONSE.headers },
  );
}

export const POST: APIRoute = async ({ request, clientAddress, session }) => {
  if (!session) return jsonErr("SESSION_UNAVAILABLE", 500);

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonErr("INVALID_REQUEST", 413);

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("application/json"))
    return jsonErr("INVALID_REQUEST", 400);

  let body: { slug?: unknown; input?: unknown; turnstile?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("INVALID_REQUEST", 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonErr("INVALID_REQUEST", 400);
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const input = typeof body.input === "string" ? body.input : "";
  const turnstile = typeof body.turnstile === "string" ? body.turnstile : "";

  if (
    !SLUG_RE.test(slug) ||
    input.length === 0 ||
    input.length > MAX_INPUT_LENGTH
  ) {
    return jsonErr("INVALID_INPUT", 400);
  }

  let turnstileSecret: string | null = null;
  try {
    turnstileSecret = await env.TURNSTILE_SECRET.get();
  } catch {
    /* secret not configured; fail closed */
  }
  if (
    !turnstileSecret ||
    !(await verifyTurnstile(turnstile, clientAddress, turnstileSecret))
  ) {
    return jsonErr("TURNSTILE_FAILED", 403);
  }

  let hash: string | null;
  try {
    hash = await getVaultHash(env, slug);
  } catch {
    return jsonErr("SERVER_ERROR", 503);
  }
  if (!hash) return jsonErr("NOT_FOUND", 404);

  let result;
  try {
    result = await verifyPasswordWithRemote(
      input,
      hash,
      env,
      slug,
      import.meta.env.SITE,
    );
  } catch {
    return jsonErr("SERVER_ERROR", 503);
  }
  if (!result.ok) {
    return jsonErr(result.error ?? "UPSTREAM_ERROR", 502);
  }
  if (!result.verified) {
    return jsonErr("VERIFY_FAILED", 200);
  }

  const existing = await session.get("user_id");
  const userId = existing ?? crypto.randomUUID();
  if (existing) {
    await session.regenerate();
  } else {
    session.set("user_id", userId);
    await session.regenerate();
  }
  await recordUnlock(env, userId, slug);

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/vault/${slug}`,
      "Cache-Control": "no-store",
    },
  });
};
