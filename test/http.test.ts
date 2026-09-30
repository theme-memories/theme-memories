import { describe, expect, it } from "vitest";
import { MAX_AUTH_BODY_BYTES, isBodyWithinLimit } from "../src/utils/http";

/*
 * The unlock endpoint's first check, and the only one that can refuse a request
 * without reading it. The declared length is the whole signal, so the cases that
 * matter are the ones where reading it is not a number.
 */
describe("isBodyWithinLimit", () => {
  it("accepts a body at exactly the limit", () => {
    expect(
      isBodyWithinLimit(String(MAX_AUTH_BODY_BYTES), MAX_AUTH_BODY_BYTES),
    ).toBe(true);
  });

  it("rejects a body one byte over the limit", () => {
    expect(
      isBodyWithinLimit(String(MAX_AUTH_BODY_BYTES + 1), MAX_AUTH_BODY_BYTES),
    ).toBe(false);
  });

  it("accepts a zero-length body", () => {
    expect(isBodyWithinLimit("0", MAX_AUTH_BODY_BYTES)).toBe(true);
  });

  it("refuses a request that declares no length at all", () => {
    expect(isBodyWithinLimit(null, MAX_AUTH_BODY_BYTES)).toBe(false);
  });

  it("refuses a length that is not a whole number of bytes", () => {
    expect(isBodyWithinLimit("", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("1.5", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("-1", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("+1", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("1e3", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("abc", MAX_AUTH_BODY_BYTES)).toBe(false);
    expect(isBodyWithinLimit("12 34", MAX_AUTH_BODY_BYTES)).toBe(false);
  });
});
