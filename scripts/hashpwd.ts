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
  const salt = crypto.randomBytes(16);
  const keylen = 64;

  return new Promise<{ hash: Buffer; salt: Buffer; updatedAt: string }>(
    (resolve, reject) => {
      // OWASP recommended parameters: N=2^16, r=8, p=2
      crypto.scrypt(
        password,
        salt,
        keylen,
        { N: Math.pow(2, 15), r: 8, p: 3 },
        (err, derivedKey) => {
          if (err) reject(err);
          else
            resolve({
              hash: derivedKey,
              salt: salt,
              updatedAt: new Date().toISOString(),
            });
        },
      );
    },
  );
}

async function main() {
  console.log("Starting scrypt password hashing process...");

  // Initialization & Table Setup
  const files = await fg(["src/content/vault/**/*.md"]);

  try {
    console.log("Initializing database table...");
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      sql: `CREATE TABLE IF NOT EXISTS passwordsscrypt (
        slug TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    });
    console.log("Database table ready.");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }

  // Content Processing
  console.log("Processing content files...");
  const batches: D1BatchQuery[] = [];
  const sql = `INSERT INTO passwordsscrypt (slug, hash, salt, updated_at) 
              VALUES (?, ?, ?, ?) 
              ON CONFLICT(slug) DO UPDATE SET 
              hash=excluded.hash, salt=excluded.salt, updated_at=excluded.updated_at`;

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
      const { hash, salt, updatedAt } = await hashPassword(password);
      batches.push({
        sql,
        params: [slug, hash.toString("hex"), salt.toString("hex"), updatedAt],
      });
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  if (batches.length > 0) {
    console.log(`Sending ${batches.length} records to D1...`);
    await cf.d1.database.query(DATABASE_ID, {
      account_id: ACCOUNT_ID,
      batch: batches,
    });
    console.log("Database updated successfully.");
  } else {
    console.log("No files to process.");
  }
}

main().catch(console.error);
