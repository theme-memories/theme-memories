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
