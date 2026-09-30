export const TURNSTILE_ACTION = "vault-unlock";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

export const isSiteverifyResultValid = (
  result: SiteverifyResult,
  options: { action: string; allowedHostnames: ReadonlySet<string> },
): boolean =>
  result.success === true &&
  result.action === options.action &&
  typeof result.hostname === "string" &&
  options.allowedHostnames.has(result.hostname);

type VerifyTurnstileOptions = {
  token: string;
  secret: string;
  remoteIp?: string;
  action: string;
  allowedHostnames: ReadonlySet<string>;
};

export const verifyTurnstile = async ({
  token,
  secret,
  remoteIp,
  action,
  allowedHostnames,
}: VerifyTurnstileOptions): Promise<boolean> => {
  if (
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH ||
    secret === "" ||
    allowedHostnames.size === 0
  ) {
    return false;
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      // The body carries the site's secret, so it is never sent onward.
      redirect: "manual",
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp !== undefined ? { remoteip: remoteIp } : {}),
      }),
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as SiteverifyResult;

    return isSiteverifyResultValid(result, { action, allowedHostnames });
  } catch {
    return false;
  }
};
