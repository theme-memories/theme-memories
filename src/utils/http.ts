/*
 * Cache directives for the responses the Worker renders per request.
 *
 * `/vault/…`, `/login/…` and `/api/auth` all carry a session, so nothing
 * between here and the reader may store them. This is the origin-side half of
 * the story: the assets layer's `public/_headers` covers the static files, and
 * a Cache Rule in the dashboard can only bypass the edge — it cannot tell the
 * browser anything the origin did not.
 */
export const NO_STORE = { "cache-control": "no-store" } as const;

/** Marks an already-built response — a redirect or a bare 404 — as unstorable. */
export const noStore = (response: Response): Response => {
  response.headers.set("cache-control", "no-store");
  return response;
};

export const jsonResponse = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...NO_STORE, ...extra },
  });

/*
 * The unlock form's body cap.
 *
 * The form carries three fields: a bounded slug, a password of at most 128
 * characters and a challenge token of at most 2048, so 8 KiB is generous even
 * with multipart boundaries — and it is the one check that can refuse a request
 * without reading it. Without it the only ceiling is the platform's, and the
 * body is parsed before anything else looks at it.
 */
export const MAX_AUTH_BODY_BYTES = 8 * 1024;

/*
 * Fail closed: a request that does not declare its length, in digits, is refused
 * rather than read. Every browser sends `content-length` on a form submission,
 * so the only requests this turns away are ones that went out of their way not
 * to — and matching digits rather than coercing means `""`, `"1.5"`, `"1e3"` and
 * `"+1"` are refusals too, rather than quietly becoming a number.
 */
export const isBodyWithinLimit = (
  contentLength: string | null,
  maxBytes: number,
): boolean => {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;

  return Number(contentLength) <= maxBytes;
};
