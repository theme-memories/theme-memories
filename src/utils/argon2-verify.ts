const encoder = new TextEncoder();

export const hmacHex = async (
  secret: string,
  message: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const signRequest = (
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> => hmacHex(secret, `${timestamp}.${body}`);

type Argon2VerifyResult = {
  success: boolean;
  errcode: number;
};

/*
 * The endpoint's answer is only a match when both halves agree. Checking one
 * alone would unlock on a response that says `errcode: 0` while reporting that
 * the password did not verify.
 */
export const isVerified = (result: Argon2VerifyResult): boolean =>
  result.success === true && result.errcode === 0;

type VerifyPasswordOptions = {
  hash: string;
  input: string;
  endpoint: string;
  hmacSecret: string;
  bypass?: string;
};

export const verifyPassword = async ({
  hash,
  input,
  endpoint,
  hmacSecret,
  bypass,
}: VerifyPasswordOptions): Promise<Argon2VerifyResult> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ desired_hash: hash, user_input: input });

  try {
    const signature = await signRequest(hmacSecret, timestamp, body);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Request-Timestamp": timestamp,
        "Request-Signature": signature,
        ...(bypass !== undefined
          ? { "x-vercel-protection-bypass": bypass }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(10_000),
      /*
       * `follow` would forward every header — including the signature and the
       * Vercel bypass — to whatever host a redirect names. A redirect is not an
       * answer to a verify request, so it is treated as a failed call.
       */
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      return { success: false, errcode: 5 };
    }

    const result = (await response.json()) as Partial<Argon2VerifyResult>;

    if (typeof result.errcode !== "number") {
      return { success: false, errcode: 5 };
    }

    return { success: result.success === true, errcode: result.errcode };
  } catch {
    return { success: false, errcode: 5 };
  }
};
