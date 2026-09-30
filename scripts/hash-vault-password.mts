import { hash } from "argon2";
import { password as passwordPrompt } from "@inquirer/prompts";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  findPasswordProblem,
} from "../src/utils/password.ts";

/*
 * The character set, worded for the reader rather than derived.
 *
 * The rule itself is `findPasswordProblem`, imported from the module the Worker
 * validates with, so a password this script accepts is one the unlock form and
 * the endpoint accept — the three cannot describe different rules. Naming the
 * symbols is the only part left to do here, and it is prose on purpose, the same
 * split the unlock form's hint uses.
 */
const PASSWORD_CHARACTERS = "A-Z a-z 0-9 ! @ # $ % ^ & *";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_PEPPER_BYTES = 32;

/*
 * The pepper rule is restated rather than shared: its authority is
 * `hasSufficientEntropy` in ../argon2/src/config.ts, which is module-private and
 * lives in another repo. Keep the two in step by hand, and change the endpoint
 * first.
 */
const isValidPepper = (value: string) =>
  BASE64_PATTERN.test(value) &&
  Buffer.from(value, "base64").length >= MIN_PEPPER_BYTES;

const readPassword = async (): Promise<string> => {
  for (;;) {
    const value = await passwordPrompt({
      message: `Vault password (${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} chars: ${PASSWORD_CHARACTERS})`,
      mask: "*",
      validate: (candidate) =>
        findPasswordProblem(candidate) === undefined ||
        `Must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters from ${PASSWORD_CHARACTERS}`,
    });

    const confirmation = await passwordPrompt({
      message: "Confirm password",
      mask: "*",
    });

    if (value === confirmation) {
      return value;
    }

    console.error("Passwords do not match. Try again.");
  }
};

const readPepper = async (): Promise<string> => {
  const fromEnv = process.env.ARGON2_PEPPER?.trim() ?? "";

  if (fromEnv !== "") {
    if (!isValidPepper(fromEnv)) {
      throw new Error(
        "ARGON2_PEPPER must be base64 encoding at least 32 bytes (openssl rand -base64 32).",
      );
    }
    return fromEnv;
  }

  return await passwordPrompt({
    message: "ARGON2_PEPPER (leave empty if the endpoint has no pepper)",
    mask: "*",
    validate: (candidate) =>
      candidate === "" ||
      isValidPepper(candidate) ||
      "Pepper must be base64 encoding at least 32 bytes, or empty",
  });
};

if (!process.stdin.isTTY) {
  console.error(
    "This script is interactive. Run it in a terminal with `pnpm hash:vault`.",
  );
  process.exit(1);
}

try {
  const password = await readPassword();
  const pepper = await readPepper();

  const digest = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    ...(pepper !== "" ? { secret: Buffer.from(pepper, "utf8") } : {}),
  });

  console.log(`\npasswordHash: "${digest}"`);
  console.log(
    "\nPaste this into the vault post's frontmatter (src/content/vault/<slug>.md).",
  );
} catch (error) {
  if ((error as { name?: string }).name === "ExitPromptError") {
    process.exit(0);
  }
  throw error;
}
