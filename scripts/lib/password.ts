// Hashes a vault password with argon2id for post-new.ts.
//
// The pepper (ARGON2_SECRET) is supplied as the argon2 secret so hashes are useless
// without it; cost params come from scripts/config.ts (ARGON2_OPTIONS) and must
// match what post-upload.ts re-validates.
import argon2 from "argon2";
import { ARGON2_OPTIONS } from "../config.ts";

export async function hashWithArgon2(
  plainPassword: string,
  pepper: string,
): Promise<string> {
  return argon2.hash(plainPassword, {
    secret: Buffer.from(pepper, "utf8"),
    ...ARGON2_OPTIONS,
  });
}
