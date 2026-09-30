import { describe, expect, it } from "vitest";
import { hmacHex, isVerified, signRequest } from "../src/utils/argon2-verify";

describe("hmacHex", () => {
  it("matches the known HMAC-SHA256 vector", async () => {
    await expect(
      hmacHex("key", "The quick brown fox jumps over the lazy dog"),
    ).resolves.toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  it("produces lowercase hex of the right length", async () => {
    const digest = await hmacHex("secret", "message");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("signRequest", () => {
  it("signs `${timestamp}.${body}`", async () => {
    const timestamp = "1700000000";
    const body = JSON.stringify({ desired_hash: "x", user_input: "y" });

    await expect(signRequest("secret", timestamp, body)).resolves.toBe(
      await hmacHex("secret", `${timestamp}.${body}`),
    );
  });
});

describe("isVerified", () => {
  it("accepts only a success with the OK errcode", () => {
    expect(isVerified({ success: true, errcode: 0 })).toBe(true);
  });

  it("refuses the OK errcode when success is false", () => {
    expect(isVerified({ success: false, errcode: 0 })).toBe(false);
  });

  it("refuses a match errcode", () => {
    expect(isVerified({ success: true, errcode: 6 })).toBe(false);
  });

  it("refuses an internal error", () => {
    expect(isVerified({ success: false, errcode: 5 })).toBe(false);
  });
});
