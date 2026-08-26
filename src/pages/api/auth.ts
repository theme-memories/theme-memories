import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
  getVaultHash,
  recordUnlock,
  verifyPasswordWithRemote,
  verifyTurnstile,
} from "../../lib/vault";

export const prerender = false;

const SLUG_RE = /^[a-zA-Z0-9_-]{1,128}$/;
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

type BodyReadResult =
  { ok: true; text: string } | { ok: false; status: 400 | 413 };

export async function readBodyAtMost(
  request: Request,
  maxBytes: number,
): Promise<BodyReadResult> {
  const rawLength = request.headers.get("Content-Length");
  if (rawLength !== null) {
    if (!/^(0|[1-9]\d*)$/.test(rawLength)) return { ok: false, status: 400 };
    const length = Number(rawLength);
    if (!Number.isSafeInteger(length) || length > maxBytes) {
      return { ok: false, status: 413 };
    }
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { ok: false, status: 400 };
  }
}

export const POST: APIRoute = async ({
  request,
  clientAddress,
  session,
  site,
}) => {
  const origin = request.headers.get("Origin");
  if (!site || origin !== site.origin) {
    return jsonErr("INVALID_REQUEST", 400);
  }
  if (!session) return jsonErr("SESSION_UNAVAILABLE", 500);

  const contentType = (request.headers.get("Content-Type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    return jsonErr("INVALID_REQUEST", 400);

  let body: { slug?: unknown; input?: unknown; turnstile?: unknown };
  const bodyResult = await readBodyAtMost(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonErr("INVALID_REQUEST", bodyResult.status);
  }
  try {
    body = JSON.parse(bodyResult.text) as typeof body;
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

  try {
    const rl = await env.VAULT_AUTH_RL.limit({ key: slug });
    if (!rl.success) return jsonErr("RATE_LIMITED", 429);
  } catch {
    return jsonErr("RATE_LIMITED", 429);
  }

  let hash: string | null;
  try {
    hash = await getVaultHash(env, slug);
  } catch {
    return jsonErr("SERVER_ERROR", 503);
  }
  if (!hash) return jsonErr("VERIFY_FAILED", 200);

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
    if (result.error === "rate_limited") {
      return jsonErr("RATE_LIMITED", 429);
    }
    return jsonErr(result.error ?? "UPSTREAM_ERROR", 502);
  }
  if (!result.verified) {
    return jsonErr("VERIFY_FAILED", 200);
  }

  const existing = await session.get("user_id");
  const userId = existing ?? crypto.randomUUID();
  await session.regenerate();
  if (!existing) {
    session.set("user_id", userId);
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
