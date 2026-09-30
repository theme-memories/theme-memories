import { describe, expect, it } from "vitest";
import { isVaultSlug } from "../src/utils/vault-slug";

/*
 * The unlock endpoint keys a rate-limit counter on the slug, so this pattern is
 * what keeps that key space to the posts that exist: without a shape to check,
 * every distinct string a caller cared to send would be a counter of its own.
 */
describe("isVaultSlug", () => {
  it("accepts the slugs the vault collection uses", () => {
    expect(isVaultSlug("first-post")).toBe(true);
    expect(isVaultSlug("update-note-6-4-0")).toBe(true);
    expect(isVaultSlug("gakkyoku-contest-proseka-next-schedule-change")).toBe(
      true,
    );
  });

  it("refuses an empty value and one that opens with a hyphen", () => {
    expect(isVaultSlug("")).toBe(false);
    expect(isVaultSlug("-leading")).toBe(false);
  });

  it("refuses anything outside lower-case alphanumerics and hyphens", () => {
    expect(isVaultSlug("First-Post")).toBe(false);
    expect(isVaultSlug("first_post")).toBe(false);
    expect(isVaultSlug("first post")).toBe(false);
    expect(isVaultSlug("../first-post")).toBe(false);
    expect(isVaultSlug("first-post/")).toBe(false);
  });

  it("accepts 64 characters and refuses 65", () => {
    expect(isVaultSlug("a".repeat(64))).toBe(true);
    expect(isVaultSlug("a".repeat(65))).toBe(false);
  });
});
