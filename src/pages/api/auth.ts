export const prerender = false;

import { env } from "cloudflare:workers";
import type { APIContext, APIRoute } from "astro";
import { isVerified, verifyPassword } from "../../utils/argon2-verify";
import {
  isBodyWithinLimit,
  jsonResponse,
  MAX_AUTH_BODY_BYTES,
} from "../../utils/http";
import { isValidPassword } from "../../utils/password";
import { getVaultEntry } from "../../utils/posts";
import { allowRequest } from "../../utils/rate-limit";
import { TURNSTILE_ACTION, verifyTurnstile } from "../../utils/turnstile";
import { storeUnlock } from "../../utils/vault-auth";
import { isVaultSlug } from "../../utils/vault-slug";

const IP_LIMIT_RETRY_AFTER_SECONDS = "10";
const SLUG_LIMIT_RETRY_AFTER_SECONDS = "60";

const rateLimited = (retryAfter: string) =>
  jsonResponse({ ok: false, error: "rate_limited" }, 429, {
    "retry-after": retryAfter,
  });

const handlePost = async ({
  request,
  session,
  clientAddress,
  site,
  url,
}: APIContext) => {
  /*
   * Cheap refusals first, and this is the cheapest: a body larger than the form
   * could possibly be is turned away from its declared length alone, before a
   * rate-limit call, before the body is read.
   */
  if (
    !isBodyWithinLimit(
      request.headers.get("content-length"),
      MAX_AUTH_BODY_BYTES,
    )
  ) {
    return jsonResponse({ ok: false, error: "server" }, 413);
  }

  if (!(await allowRequest(env.AUTH_IP_RATE_LIMIT, clientAddress))) {
    console.error(
      JSON.stringify({
        message: "auth rate limited",
        scope: "address",
        address: clientAddress,
      }),
    );
    return rateLimited(IP_LIMIT_RETRY_AFTER_SECONDS);
  }

  const form = await request.formData();
  const slug = form.get("slug");
  const password = form.get("password");
  const token = form.get("cf-turnstile-response");

  if (
    typeof slug !== "string" ||
    !isVaultSlug(slug) ||
    typeof password !== "string" ||
    session === undefined
  ) {
    return jsonResponse({ ok: false, error: "server" }, 400);
  }

  /*
   * The post is resolved before the challenge, so a slug that names nothing is
   * answered for the cost of a lookup: it never spends a token and never becomes
   * a rate-limit key.
   */
  const post = await getVaultEntry(slug);
  if (post === undefined) {
    return jsonResponse({ ok: false, error: "server" }, 404);
  }

  const allowedHostnames = new Set<string>();
  if (site !== undefined) {
    allowedHostnames.add(site.hostname);
  }
  if (import.meta.env.DEV) {
    allowedHostnames.add(url.hostname);
  }

  const verified = await verifyTurnstile({
    token: typeof token === "string" ? token : "",
    secret: await env.TURNSTILE_SECRET.get(),
    remoteIp: clientAddress,
    action: TURNSTILE_ACTION,
    allowedHostnames,
  });

  if (!verified) {
    return jsonResponse({ ok: false, error: "blocked" }, 403);
  }

  /*
   * The per-post budget is charged only after the challenge, so it cannot be
   * spent by anyone who is not solving one: a burst of junk requests costs a
   * token each and never touches a post's allowance. What is left for the
   * counter to do is bound guesses against a single post, which the per-address
   * limit cannot — a rotating set of addresses never trips it. The key is the
   * resolved slug rather than the submitted one, so the counter holds one entry
   * per real post and nothing else.
   */
  if (!(await allowRequest(env.AUTH_SLUG_RATE_LIMIT, post.data.slug))) {
    console.error(
      JSON.stringify({
        message: "auth rate limited",
        scope: "post",
        slug: post.data.slug,
        address: clientAddress,
      }),
    );
    return rateLimited(SLUG_LIMIT_RETRY_AFTER_SECONDS);
  }

  if (!isValidPassword(password)) {
    return jsonResponse({ ok: false, error: "invalid" });
  }

  const [endpoint, hmacSecret, bypass] = await Promise.all([
    env.ARGON2_ENDPOINT.get(),
    env.ARGON2_HMAC_SECRET.get(),
    env.VERCEL_PROTECTION_BYPASS.get(),
  ]);

  const result = await verifyPassword({
    hash: post.data.passwordHash,
    input: password,
    endpoint,
    hmacSecret,
    bypass,
  });

  if (isVerified(result)) {
    await session.regenerate();

    let userid = await session.get("userid");
    if (userid === undefined) {
      userid = crypto.randomUUID();
      session.set("userid", userid);
    }

    await storeUnlock(env.DB, userid, slug, Math.floor(Date.now() / 1000));

    return jsonResponse({ ok: true, redirect: `/vault/${slug}` });
  }

  if (result.errcode === 6) {
    console.error(
      JSON.stringify({
        message: "unlock mismatch",
        slug,
        address: clientAddress,
      }),
    );
    return jsonResponse({ ok: false, error: "invalid" });
  }

  return jsonResponse({ ok: false, error: "server" }, 502);
};

export const POST: APIRoute = async (context) => {
  try {
    return await handlePost(context);
  } catch {
    return jsonResponse({ ok: false, error: "server" }, 500);
  }
};
