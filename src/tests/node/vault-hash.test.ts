import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import {
  assertPublishableHash,
  buildVaultSyncSql,
  EXPECTED_ARGON2,
  isCanonicalBase64,
  isValidArgon2Phc,
  parseVaultRows,
} from "../../lib/vault-hash";

const SALT_22 = "MC4xMjM0NTY3ODkwYWJjZA";
const DIGEST_43 = "dGhpcyBpcyBhIDMyLWJ5dGUgZGlnZXN0IHN0YW5kaW4";

function phc(m: number, t: number, p: number): string {
  return `$argon2id$v=19$m=${m},t=${t},p=${p}$${SALT_22}$${DIGEST_43}`;
}

describe("isValidArgon2Phc / isCanonicalBase64", () => {
  it("accepts a well-formed argon2id PHC string", () => {
    expect(isValidArgon2Phc(phc(19456, 2, 1))).toBe(true);
  });

  it("rejects wrong algorithm, version or shape", () => {
    expect(
      isValidArgon2Phc(`$argon2i$v=19$m=19456,t=2,p=1$${SALT_22}$${DIGEST_43}`),
    ).toBe(false);
    expect(
      isValidArgon2Phc(`$argon2id$v=x$m=19456,t=2,p=1$${SALT_22}$${DIGEST_43}`),
    ).toBe(false);
    expect(
      isValidArgon2Phc(`$argon2id$v=19$m=19456,t=2$${SALT_22}$${DIGEST_43}`),
    ).toBe(false);
    expect(
      isValidArgon2Phc(
        `$argon2id$v=19$m=19456,t=2,p=1,p=2$${SALT_22}$${DIGEST_43}`,
      ),
    ).toBe(false);
    expect(
      isValidArgon2Phc(
        `$argon2id$v=19$m=19456,t=2,q=1$${SALT_22}$${DIGEST_43}`,
      ),
    ).toBe(false);
    expect(isValidArgon2Phc("$argon2id$v=19$m=19456,t=2,p=1")).toBe(false);
    expect(
      isValidArgon2Phc(
        `$argon2id$v=19$m=19456,t=2,p=1$${SALT_22}=x$${DIGEST_43}`,
      ),
    ).toBe(false);
    expect(
      isValidArgon2Phc(`$argon2id$v=19$m=19456,t=2,p=1$ab cd$${DIGEST_43}`),
    ).toBe(false);
  });

  it("isCanonicalBase64 enforces unpadded canonical encoding", () => {
    expect(isCanonicalBase64(DIGEST_43)).toBe(true);
    expect(isCanonicalBase64(`${DIGEST_43}=`)).toBe(false);
    expect(isCanonicalBase64("a+b/")).toBe(true);
    expect(isCanonicalBase64("a-b_c")).toBe(false);
  });
});

describe("assertPublishableHash", () => {
  it("accepts a real hash matching the expected cost parameters", async () => {
    const hash = await argon2.hash(
      "correct horse battery staple",
      EXPECTED_ARGON2,
    );
    await expect(assertPublishableHash(hash)).resolves.toBeUndefined();
  });

  it("rejects hashes with weaker/other cost parameters", async () => {
    const weak = await argon2.hash("pw", {
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    await expect(assertPublishableHash(weak)).rejects.toThrow(/rehash|cost/i);
  });

  it.each([
    ["", /length out of bounds/],
    ["x".repeat(129), /length out of bounds/],
    ["not-a-phc", /well-formed argon2id/],
  ])("rejects %s", async (hash, pattern) => {
    await expect(assertPublishableHash(hash)).rejects.toThrow(pattern);
  });
});

describe("buildVaultSyncSql", () => {
  const H_A_OLD = phc(19456, 2, 1);

  it("revokes + upserts only changed and new slugs; unchanged stay untouched", () => {
    const current = new Map([
      ["changed-slug", H_A_OLD],
      ["new-slug", phc(19456, 2, 1)],
      ["same-slug", H_A_OLD],
    ]);
    const existing = new Map([
      ["changed-slug", "$argon2id$v=19$m=19456,t=2,p=1$AAAA$BBBB"],
      ["same-slug", H_A_OLD],
    ]);

    const lines = buildVaultSyncSql(current, existing);
    const joined = lines.join("\n");

    expect(
      joined.match(/DELETE FROM unlocks WHERE slug = 'changed-slug';/g),
    ).toHaveLength(1);
    expect(joined).toContain(
      "INSERT INTO vault (slug, password_hash, updated_at) VALUES ('changed-slug'",
    );
    expect(
      joined.match(/DELETE FROM unlocks WHERE slug = 'new-slug';/g),
    ).toHaveLength(1);
    expect(joined).toContain("'new-slug'");
    expect(
      lines.some(
        (l) =>
          (l.startsWith("DELETE FROM unlocks WHERE slug = ") ||
            l.startsWith("INSERT INTO vault")) &&
          l.includes("'same-slug'"),
      ),
    ).toBe(false);
    expect(joined).toContain(
      "DELETE FROM vault WHERE slug NOT IN ('changed-slug', 'new-slug', 'same-slug');",
    );
    expect(joined).toContain(
      "DELETE FROM unlocks WHERE slug NOT IN ('changed-slug', 'new-slug', 'same-slug');",
    );
  });

  it("clears everything when no vault posts remain", () => {
    const lines = buildVaultSyncSql(new Map(), new Map([["old", "hash"]]));
    expect(lines).toEqual(["DELETE FROM unlocks;", "DELETE FROM vault;"]);
  });

  it("throws on slugs that bypass the charset guard", () => {
    const current = new Map([["bad'; DROP TABLE vault;--", "h"]]);
    expect(() => buildVaultSyncSql(current, new Map())).toThrow(
      /invalid vault slug/,
    );
  });
});

describe("parseVaultRows", () => {
  it("parses wrangler --json output blocks", () => {
    const stdout = JSON.stringify([
      { results: [{ slug: "a", password_hash: "h1" }], success: true },
      { results: [{ slug: "b", password_hash: "h2" }], success: true },
    ]);
    expect(parseVaultRows(stdout)).toEqual(
      new Map([
        ["a", "h1"],
        ["b", "h2"],
      ]),
    );
  });

  it("ignores malformed rows and hostile slugs", () => {
    const stdout = JSON.stringify([
      {
        results: [
          { slug: "ok", password_hash: "h" },
          { slug: 42, password_hash: "h" },
          { slug: "evil';--", password_hash: "h" },
          { slug: "no-hash" },
          "garbage",
        ],
      },
    ]);
    expect(parseVaultRows(stdout)).toEqual(new Map([["ok", "h"]]));
  });
});
