import { expect, describe, it, afterEach, vi } from "vitest";
import {
  isSafeAssetKey,
  mintVerifyJwt,
  readSecret,
  signAssetUrlsInHtml,
  signAssetUrl,
  verifyTurnstile,
  verifySignedAsset,
} from "../../lib/vault";

const SECRET = "test-signing-secret-0123456789abcdef";
const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(digest));
}

let frozenNow: number | null = null;
const realNow = Date.now;

function freezeAt(epochSeconds: number): void {
  frozenNow = epochSeconds * 1000;
  Date.now = () => frozenNow!;
}

afterEach(() => {
  Date.now = realNow;
  frozenNow = null;
  vi.unstubAllGlobals();
});

describe("isSafeAssetKey", () => {
  const valid = [
    "demo/photo.png",
    "demo/sub/dir/movie.mp4",
    "a/b.txt",
    "Demo_Slug-1/img-01.v2.webp",
  ];
  const invalid = [
    "",
    "noslash.png",
    "/leading.png",
    "trailing/",
    "demo/../secret.png",
    "demo/./photo.png",
    "demo//double.png",
    "demo/photo.png?query=1",
    "demo/photo png",
    "demo/sp%20ace.png",
    `${"a".repeat(129)}/b.png`,
    `${"a".repeat(64)}/${"b".repeat(256)}.png`,
  ];

  it.each(valid)("accepts %s", (key) => {
    expect(isSafeAssetKey(key)).toBe(true);
  });

  it.each(invalid)("rejects %s", (key) => {
    expect(isSafeAssetKey(key)).toBe(false);
  });
});

describe("signAssetUrl / verifySignedAsset", () => {
  it("produces a URL that verifies", async () => {
    freezeAt(1_000_000);
    const url = await signAssetUrl("demo/photo.png", SECRET);
    const parsed = new URL(`https://amia.work${url}`);
    expect(parsed.pathname).toBe("/api/vault/demo/photo.png");
    const ok = await verifySignedAsset(
      "demo/photo.png",
      parsed.searchParams.get("exp")!,
      parsed.searchParams.get("sig")!,
      SECRET,
    );
    expect(ok).toBe(true);
  });

  it("rejects a wrong secret", async () => {
    freezeAt(1_000_000);
    const url = new URL(
      `https://amia.work${await signAssetUrl("demo/a.png", SECRET)}`,
    );
    const ok = await verifySignedAsset(
      "demo/a.png",
      url.searchParams.get("exp")!,
      url.searchParams.get("sig")!,
      "different-secret-0123456789abcdef",
    );
    expect(ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    freezeAt(1_000_000);
    const url = new URL(
      `https://amia.work${await signAssetUrl("demo/a.png", SECRET)}`,
    );
    freezeAt(1_000_000 + 301);
    const ok = await verifySignedAsset(
      "demo/a.png",
      url.searchParams.get("exp")!,
      url.searchParams.get("sig")!,
      SECRET,
    );
    expect(ok).toBe(false);
  });

  it("rejects exp further than the TTL window ahead", async () => {
    freezeAt(1_000_000);
    const farFuture = String(1_000_000 + 10_000);
    const sig = await hmac(SECRET, `${farFuture}.demo/a.png`);
    const ok = await verifySignedAsset("demo/a.png", farFuture, sig, SECRET);
    expect(ok).toBe(false);
  });

  it("rejects a tampered exp with the original signature", async () => {
    freezeAt(1_000_000);
    const url = new URL(
      `https://amia.work${await signAssetUrl("demo/a.png", SECRET)}`,
    );
    freezeAt(1_000_001);
    const tamperedExp = String(Number(url.searchParams.get("exp")) + 1);
    const ok = await verifySignedAsset(
      "demo/a.png",
      tamperedExp,
      url.searchParams.get("sig")!,
      SECRET,
    );
    expect(ok).toBe(false);
  });

  it("rejects malformed inputs without throwing", async () => {
    freezeAt(1_000_000);
    const cases: Array<[string, string, string]> = [
      ["demo/a.png", "", ""],
      ["demo/a.png", "abc", "A".repeat(43)],
      ["demo/a.png", "123", "short"],
      ["../evil/x.png", "1000005", "A".repeat(43)],
      ["demo/a.png", `${"9".repeat(13)}`, "A".repeat(43)],
    ];
    for (const [key, expRaw, sig] of cases) {
      expect(await verifySignedAsset(key, expRaw, sig, SECRET)).toBe(false);
    }
  });

  it("uses the requested short-lived expiry", async () => {
    freezeAt(1_000_000);
    const url = new URL(
      `https://amia.work${await signAssetUrl("demo/a.png", SECRET, 120)}`,
    );
    expect(Number(url.searchParams.get("exp"))).toBe(1_000_120);
  });

  it("enforces TTL bounds on explicit lifetimes", async () => {
    freezeAt(1_000_000);
    for (const ttl of [0, -1, 301, 10.5, Number.NaN]) {
      await expect(signAssetUrl("demo/a.png", SECRET, ttl)).rejects.toThrow(
        /lifetime/,
      );
    }
  });
});

describe("mintVerifyJwt", () => {
  it("emits verifiable HS256 tokens with the expected claims", async () => {
    freezeAt(5_000_000);
    const token = await mintVerifyJwt(
      SECRET,
      "some-slug",
      "https://verify.example",
      "https://amia.work",
      60,
    );
    const [headB64, bodyB64, sig] = token.split(".");
    expect(
      JSON.parse(atob(headB64.replace(/-/g, "+").replace(/_/g, "/"))),
    ).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    const payload = JSON.parse(
      atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as Record<string, unknown>;
    expect(payload).toMatchObject({
      iss: "https://amia.work",
      aud: "https://verify.example",
      sub: "some-slug",
      iat: 5_000_000,
      exp: 5_000_060,
    });
    expect(sig).toBe(await hmac(SECRET, `${headB64}.${bodyB64}`));
  });

  it("signatures do not verify under a different secret or modified payload", async () => {
    freezeAt(5_000_000);
    const token = await mintVerifyJwt(
      SECRET,
      "s",
      "https://a.example",
      "https://i.example",
    );
    const [head, body, sig] = token.split(".");
    expect(sig).not.toBe(
      await hmac("other-secret-0123456789abcdef", `${head}.${body}`),
    );
    const tamperedBody =
      body.slice(0, -2) + (body.endsWith("AA") ? "BB" : "AA");
    expect(sig).not.toBe(await hmac(SECRET, `${head}.${tamperedBody}`));
  });
});

describe("verifyTurnstile", () => {
  const response = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("accepts only a successful vault-login token for amia.work", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          success: true,
          action: "vault-login",
          hostname: "amia.work",
        }),
      ),
    );

    await expect(
      verifyTurnstile("token", "203.0.113.9", "turnstile-secret"),
    ).resolves.toBe(true);
  });

  it.each([
    { success: true, hostname: "amia.work" },
    { success: true, action: "other-action", hostname: "amia.work" },
    { success: true, action: "vault-login", hostname: "other.example" },
    { success: true, action: "vault-login" },
    { success: false, action: "vault-login", hostname: "amia.work" },
  ])("rejects an invalid verification response: %j", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(body)),
    );

    await expect(
      verifyTurnstile("token", "203.0.113.9", "turnstile-secret"),
    ).resolves.toBe(false);
  });
});

describe("signAssetUrlsInHtml", () => {
  it("signs only /api/vault/ references and leaves other markup intact", async () => {
    freezeAt(2_000_000);
    const html =
      '<p><img src="/api/vault/demo/a.png" alt="x"> <a href="https://elsewhere.example/page">out</a> <img src="/img/local.png"></p>';
    const out = await signAssetUrlsInHtml(html, SECRET);

    expect(out).toContain('src="/api/vault/demo/a.png?exp=');
    expect(out).toContain('href="https://elsewhere.example/page"');
    expect(out).toContain('src="/img/local.png"');

    const refs = [...out.matchAll(/\/api\/vault\/([^\s"'`<>]+)/g)].map(
      (m) => m[1],
    );
    expect(refs).toHaveLength(1);
    const [key, search] = refs[0]!.split("?");
    const params = new URLSearchParams(search);
    expect(
      await verifySignedAsset(
        key!,
        params.get("exp")!,
        params.get("sig")!,
        SECRET,
      ),
    ).toBe(true);
  });

  it("leaves malformed keys unsigned instead of throwing", async () => {
    freezeAt(2_000_000);
    const html = '<p><img src="/api/vault/demo/画像(1).png"></p>';
    await expect(signAssetUrlsInHtml(html, SECRET)).resolves.toBe(html);
  });

  it("does not sign keys outside the requested slug", async () => {
    freezeAt(2_000_000);
    const html =
      '<p><img src="/api/vault/other/a.png"><img src="/api/vault/demo/a.png"></p>';
    const out = await signAssetUrlsInHtml(html, SECRET, "demo");

    expect(out).toContain('src="/api/vault/other/a.png"');
    expect(out).toContain('src="/api/vault/demo/a.png?exp=');

    const refs = [...out.matchAll(/\/api\/vault\/([^\s"'`<>]+)/g)].map(
      (m) => m[1],
    );
    const signedRef = refs.find((ref) => ref.includes("?"))!;
    const [key, search] = signedRef.split("?");
    expect(key).toBe("demo/a.png");
    const params = new URLSearchParams(search);
    await expect(
      verifySignedAsset(key!, params.get("exp")!, params.get("sig")!, SECRET),
    ).resolves.toBe(true);
  });
});

describe("readSecret", () => {
  it("passes plain strings through and unwraps secret-like bindings", async () => {
    await expect(readSecret("literal")).resolves.toBe("literal");
    await expect(
      readSecret({ get: async () => "from-store" } as never),
    ).resolves.toBe("from-store");
    await expect(
      readSecret({ get: async () => undefined } as never),
    ).resolves.toBeNull();
    await expect(
      readSecret({
        get: async () => {
          throw new Error("store down");
        },
      } as never),
    ).resolves.toBeNull();
  });
});
