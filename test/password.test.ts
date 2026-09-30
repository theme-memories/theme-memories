import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  findPasswordProblem,
  isValidPassword,
} from "../src/utils/password";

/*
 * The unlock form writes the message a reader sees from this result, so each
 * rejection has to keep naming the half of the rule that was actually missed.
 * A password can be outside the length and outside the character set at once;
 * length is what it is told, because that is the fix it can make from the
 * keyboard alone.
 */
describe("findPasswordProblem", () => {
  it("returns nothing for a compliant password", () => {
    expect(findPasswordProblem("2#XswLoPePQG9qcEnyLe8$*x!AdL9pza")).toBe(
      undefined,
    );
  });

  it("names the length when the value is too short or too long", () => {
    expect(findPasswordProblem("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      "length",
    );
    expect(findPasswordProblem("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      "length",
    );
    expect(findPasswordProblem("")).toBe("length");
  });

  it("names the character set when the length is fine", () => {
    expect(findPasswordProblem("aaaaaaaaaaaaaa-")).toBe("characters");
    expect(findPasswordProblem("aaaaaaaaaaaaaa_")).toBe("characters");
  });

  it("reports length ahead of the character set when both are broken", () => {
    expect(findPasswordProblem("short-")).toBe("length");
  });
});

describe("isValidPassword", () => {
  it("accepts a compliant password", () => {
    expect(isValidPassword("2#XswLoPePQG9qcEnyLe8$*x!AdL9pza")).toBe(true);
  });

  it("rejects passwords shorter than the minimum", () => {
    expect(isValidPassword("changeme")).toBe(false);
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
  });

  it("accepts exactly the minimum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(isValidPassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects characters outside the allowed set", () => {
    expect(isValidPassword("aaaaaaaaaaaaaaa-")).toBe(false);
    expect(isValidPassword("aaaaaaaaaaaaaaa_")).toBe(false);
    expect(isValidPassword("aaaaaaaaaaaaaaa ")).toBe(false);
  });

  it("accepts every allowed symbol", () => {
    expect(isValidPassword("!@#$%^&*aaaaaaaaa")).toBe(true);
  });
});
