import { confirm, input, password, select } from "@inquirer/prompts";
import argon2 from "argon2";
import { mkdirSync, writeFileSync } from "node:fs";
import { EOL } from "node:os";
import { join } from "node:path";
import {
  ARGON2_OPTIONS,
  DEFAULT_VAULT_QUESTION,
  VAULT_CATEGORIES,
} from "./config.ts";

const CONTENT_ROOT = join(process.cwd(), "src", "content");

function isCancelError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "CancelPromptError" || name === "ExitPromptError";
}

async function ask<T>(promise: Promise<T>, what = "Operation"): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (isCancelError(err)) {
      console.log(`\n${what} cancelled.`);
      process.exit(0);
    }
    throw err;
  }
}

function randomSlug(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function formatNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function yamlValue(value: string | boolean | undefined): string {
  if (typeof value === "boolean") return String(value);
  if (value === undefined || value === "") return '""';
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function main(): Promise<void> {
  const type = await ask(
    select({
      message: "Which post type do you want to create?",
      choices: [
        { name: "Article (public)", value: "article" },
        { name: "Vault (password protected)", value: "vault" },
      ],
    }),
    "Selection",
  );

  const slugDefault = randomSlug();
  const slug = (
    await ask(
      input({
        message: "slug",
        default: slugDefault,
        validate: (v) =>
          /^[A-Za-z0-9_-]+$/.test(v.trim())
            ? true
            : "Use alphanumerics, - or _",
      }),
      "slug",
    )
  ).trim();

  const title = (
    await ask(
      input({
        message: "title",
        validate: (v) => (v.trim() ? true : "title is required"),
      }),
      "title",
    )
  ).trim();

  const publishedAt = (
    await ask(
      input({
        message: "publishedAt (YYYY-MM-DD HH:MM:SS)",
        default: formatNow(),
      }),
      "publishedAt",
    )
  ).trim();

  const category = await ask(
    select({
      message: "category",
      choices: VAULT_CATEGORIES.map((c) => ({ name: c, value: c })),
    }),
    "category",
  );

  const thumb = (
    await ask(
      input({
        message: "thumb (optional asset filename)",
        default: "",
      }),
      "thumb",
    )
  ).trim();

  const description = (
    await ask(
      input({
        message: "description",
        validate: (v) => (v.trim() ? true : "description is required"),
      }),
      "description",
    )
  ).trim();

  const pinned = await ask(
    confirm({ message: "pinned?", default: false }),
    "pinned",
  );
  const draft = await ask(
    confirm({ message: "draft?", default: true }),
    "draft",
  );
  if (draft) {
    console.log(
      "⚠️  This post is marked as draft — it will NOT be rendered or published until you set `draft: false`.",
    );
  }
  const defaultProtected = type !== "vault";
  const isProtected = await ask(
    confirm({ message: "protected?", default: defaultProtected }),
    "protected",
  );
  if (isProtected === defaultProtected) {
    if (type === "vault") {
      console.log(
        "⚠️  Default kept: vault posts require `protected: true`. Leaving it `false` will fail the CI/CD publish step — choose `y` to protect it.",
      );
    } else {
      console.log(
        "⚠️  Default kept: articles must not be protected. Leaving it `true` will fail the CI/CD build step — choose `n` to keep it public.",
      );
    }
  }

  const fields: Record<string, string | boolean> = {
    slug,
    title,
    publishedAt,
    category,
    thumb: thumb || "",
    description,
    pinned,
    draft,
    protected: isProtected,
  };

  if (type === "vault") {
    const question = (
      await ask(
        input({
          message: "question (prompt shown to readers)",
          default: DEFAULT_VAULT_QUESTION,
        }),
        "question",
      )
    ).trim();
    fields.question = question;

    let pepper = process.env.ARGON2_SECRET;
    if (!pepper) {
      pepper = await ask(
        password({
          message:
            "ARGON2_SECRET (pepper) not found in env — enter it now (masked)",
          mask: true,
          validate: (v) => (v.length >= 1 ? true : "pepper is required"),
        }),
        "pepper",
      );
    }

    const plainPassword = await ask(
      password({
        message: "password (will be hashed with argon2)",
        mask: true,
        validate: (v) => (v.length >= 1 ? true : "password is required"),
      }),
      "password",
    );

    const hash = await argon2.hash(plainPassword, {
      secret: Buffer.from(pepper, "utf8"),
      ...ARGON2_OPTIONS,
    });
    fields.passwordHash = hash;
  }

  const lines = Object.entries(fields).map(
    ([key, value]) => `${key}: ${yamlValue(value)}`,
  );

  const body = [`---`, ...lines, `---`, ``, ``].join(EOL);

  const dir = join(CONTENT_ROOT, type, slug);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "index.md");
  writeFileSync(file, body, "utf8");

  console.log(`\nCreated ${file}`);
  if (type === "vault") {
    console.log(
      "passwordHash written. Run `pnpm content:prepare` before publishing.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
