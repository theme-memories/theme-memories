import fs from "node:fs";
import Cloudflare from "cloudflare";
import fg from "fast-glob";
import matter from "gray-matter";
import argon2 from "argon2";
import { DEFAULT_PASSWORD } from "../src/content/constants.js";

interface D1BatchQuery {
  sql: string;
  params: string[];
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID as string;
const DATABASE_ID = process.env.HASHPWD_DATABASE_ID as string;
const cf = new Cloudflare();

// Password Hashing Utility
async function hashPassword(password: string) {
  // OWASP recommended parameters for Argon2id:
  // m=65536 (64 MiB), t=3 iterations, p=4 parallelism
  const hash = await argon2.hash(password);

  return {
    hash,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log("Starting password hashing process...");

  // Initialization & Table Setup
  const files = await fg(["src/content/vault/**/*.md"]);

  try {
    console.log("Initializing hash database table...");
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      sql: `CREATE TABLE IF NOT EXISTS passwords (
        slug TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    });
    console.log("Hash database table ready.");
  } catch (error) {
    console.error("Failed to initialize hash database table:", error);
    process.exit(1);
  }

  try {
    console.log("Initializing unlocked database table...");
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      sql: `CREATE TABLE IF NOT EXISTS unlocks (
        userid TEXT NOT NULL,
        slug TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        PRIMARY KEY (userid, slug)
      );`,
    });
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      sql: `CREATE INDEX IF NOT EXISTS idx_unlocks_expiry ON unlocks(unlocked_at);`,
    });
    console.log("Unlocked database table ready.");
  } catch (error) {
    console.error("Failed to initialize unlocked database table:", error);
    process.exit(1);
  }

  // Content Processing
  console.log("Processing content files...");
  const batches: D1BatchQuery[] = [];
  const sql = `INSERT INTO passwords (slug, hash, updated_at) 
              VALUES (?, ?, ?) 
              ON CONFLICT(slug) DO UPDATE SET 
              hash=excluded.hash, updated_at=excluded.updated_at`;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf8");
      const { data } = matter(content);
      const password = data.password || DEFAULT_PASSWORD;
      const slug = data.slug;
      const { hash, updatedAt } = await hashPassword(password);
      batches.push({
        sql,
        params: [slug, hash, updatedAt],
      });
    } catch (error) {
      console.error("Error processing a content file:", error);
    }
  }

  // Database Update
  if (batches.length > 0) {
    try {
      console.log("Writing hashes to hash database...");
      await cf.d1.database.query(DATABASE_ID, {
        account_id: ACCOUNT_ID,
        batch: batches,
      });
      console.log("Successfully updated hashes.");
    } catch (error) {
      console.error("Failed to save hashes to hash database:", error);
      process.exit(1);
    }
  } else {
    console.log("No passwords found to process.");
  }
}

main().catch(console.error);
