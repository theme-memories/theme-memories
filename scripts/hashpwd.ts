import fs from "node:fs";
import crypto from "node:crypto";
import Cloudflare from "cloudflare";
import fg from "fast-glob";
import YAML from "yaml";
import { markdownToHtml } from "satteri";
import { DEFAULT_PASSWORD } from "../src/content/constants.js";

interface frontmatterData {
  password?: string;
  slug: string;
}
interface D1BatchQuery {
  sql: string;
  params: string[];
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID as string;
const DATABASE_ID = process.env.HASHPWD_DATABASE_ID as string;
const cf = new Cloudflare();

// Password Hashing Utility
async function hashPassword(password: string) {
  const saltBuffer = crypto.randomBytes(16);
  const iterations = 220000;
  const keylen = 64;
  const digest = "sha512";
  return new Promise<{
    hash: Buffer;
    salt: Buffer;
    updatedAt: string;
  }>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      saltBuffer,
      iterations,
      keylen,
      digest,
      (err, derivedKey) => {
        if (err) reject(err);
        else
          resolve({
            hash: derivedKey,
            salt: saltBuffer,
            updatedAt: new Date().toISOString(),
          });
      },
    );
  });
}

async function main() {
  // Initialization & Table Setup
  const files = await fg(["src/content/vault/**/*.md"]);
  await cf.d1.database.query(DATABASE_ID, {
    account_id: ACCOUNT_ID,
    sql: `CREATE TABLE IF NOT EXISTS passwords (
      slug TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
  });

  // Content Processing
  const batches: D1BatchQuery[] = [];
  const sql = `INSERT INTO passwords (slug, hash, salt, updated_at) 
              VALUES (?, ?, ?, ?) 
              ON CONFLICT(slug) DO UPDATE SET 
              hash=excluded.hash, salt=excluded.salt, updated_at=excluded.updated_at`;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const { frontmatter } = markdownToHtml(content);
    if (!frontmatter) {
      continue;
    }
    const data: frontmatterData = YAML.parse(frontmatter.value);
    const password = data.password || DEFAULT_PASSWORD;
    const slug = data.slug;
    const { hash, salt, updatedAt } = await hashPassword(password);
    batches.push({
      sql,
      params: [slug, hash.toString("hex"), salt.toString("hex"), updatedAt],
    });
  }

  // Database Update
  if (batches.length > 0) {
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      batch: batches,
    });
    console.log("Successfully saved all hashes.");
  }
}

main().catch(console.error);
