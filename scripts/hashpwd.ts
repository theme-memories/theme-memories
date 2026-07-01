import fs from "node:fs";
import Cloudflare from "cloudflare";
import fg from "fast-glob";
import YAML from "yaml";
import { markdownToHtml } from "satteri";
import argon2 from "argon2";
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
    console.log("Initializing database table...");
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      sql: `CREATE TABLE IF NOT EXISTS passwords (
        slug TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    });
    console.log("Database table ready.");
  } catch (error) {
    console.error("Failed to initialize database table:", error);
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
      const { frontmatter } = markdownToHtml(content);
      if (!frontmatter) {
        continue;
      }
      const data: frontmatterData = YAML.parse(frontmatter.value);
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
      console.log("Writing hashes to database...");
      await cf.d1.database.query(DATABASE_ID, {
        account_id: ACCOUNT_ID,
        batch: batches,
      });
      console.log("Successfully updated passwords in database.");
    } catch (error) {
      console.error("Failed to save hashes to database:", error);
      process.exit(1);
    }
  } else {
    console.log("No passwords found to process.");
  }
}

main().catch(console.error);
