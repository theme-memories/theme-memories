/*
 * Abuse control for the unlock endpoint.
 *
 * The dashboard rule caps requests per address at the edge, but it cannot count
 * per post, and its block page is not the JSON the unlock form parses. These
 * counters run inside the Worker instead, so a tripped limit answers with a 429
 * the page can explain, and guesses against a single post stay bounded however
 * many addresses they arrive from.
 *
 * The binding is a simple counter with per-location eventual consistency, so
 * this is abuse control rather than an exact quota.
 */
export const allowRequest = async (
  limiter: RateLimit,
  key: string,
): Promise<boolean> => (await limiter.limit({ key })).success;
