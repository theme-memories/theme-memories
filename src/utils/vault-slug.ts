/*
 * What a vault slug may look like.
 *
 * `getVaultEntry` matches a slug exactly, so this is not what makes a lookup
 * correct — it is what keeps the slug from becoming an unbounded set of its own
 * somewhere else. The unlock endpoint keys a rate-limit counter on it, and with
 * no shape to check, every distinct string a caller cared to send would be a
 * counter of its own.
 *
 * It lives on its own, apart from `posts.ts`, for the same reason `password.ts`
 * does: the content collection is behind `astro:content`, which the test runtime
 * cannot resolve, and a rule this cheap to get wrong is worth a test.
 */
const VAULT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const isVaultSlug = (value: string): boolean =>
  VAULT_SLUG_PATTERN.test(value);
