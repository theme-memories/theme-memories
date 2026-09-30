import { describe, expect, it } from "vitest";
import { isSiteverifyResultValid } from "../src/utils/turnstile";

const options = {
  action: "vault-unlock",
  allowedHostnames: new Set(["amia.work"]),
};

describe("isSiteverifyResultValid", () => {
  it("accepts a successful, matching result", () => {
    expect(
      isSiteverifyResultValid(
        { success: true, action: "vault-unlock", hostname: "amia.work" },
        options,
      ),
    ).toBe(true);
  });

  it("rejects a failed challenge", () => {
    expect(
      isSiteverifyResultValid(
        { success: false, action: "vault-unlock", hostname: "amia.work" },
        options,
      ),
    ).toBe(false);
  });

  it("rejects a mismatched action", () => {
    expect(
      isSiteverifyResultValid(
        { success: true, action: "signup", hostname: "amia.work" },
        options,
      ),
    ).toBe(false);
  });

  it("rejects a hostname outside the allowlist", () => {
    expect(
      isSiteverifyResultValid(
        { success: true, action: "vault-unlock", hostname: "evil.example" },
        options,
      ),
    ).toBe(false);
  });

  it("rejects a missing hostname", () => {
    expect(
      isSiteverifyResultValid(
        { success: true, action: "vault-unlock" },
        options,
      ),
    ).toBe(false);
  });
});
