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

export const POST: APIRoute = async ({ request, clientAddress, session }) => {
  if (!session) {
    return Response.json(
      { success: false, errcode: "SESSION_UNAVAILABLE" },
      { status: 500 },
    );
  }

  let body: { slug?: unknown; input?: unknown; turnstile?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { success: false, errcode: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const input = typeof body.input === "string" ? body.input : "";
  const turnstile = typeof body.turnstile === "string" ? body.turnstile : "";

  if (
    !SLUG_RE.test(slug) ||
    input.length === 0 ||
    input.length > MAX_INPUT_LENGTH
  ) {
    return Response.json(
      { success: false, errcode: "INVALID_INPUT" },
      { status: 400 },
    );
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
    return Response.json(
      { success: false, errcode: "TURNSTILE_FAILED" },
      { status: 403 },
    );
  }

  const hash = await getVaultHash(env, slug);
  if (!hash) {
    return Response.json(
      { success: false, errcode: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const result = await verifyPasswordWithRemote(
    input,
    hash,
    env,
    slug,
    import.meta.env.SITE,
  );
  if (!result.ok) {
    return Response.json(
      { success: false, errcode: result.error ?? "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }
  if (!result.verified) {
    return Response.json(
      { success: false, errcode: "VERIFY_FAILED" },
      { status: 200 },
    );
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
    headers: { Location: `/vault/${slug}` },
  });
};
