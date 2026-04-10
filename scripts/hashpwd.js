import fs from "fs";
import matter from "gray-matter";
import argon2 from "argon2";
import { MongoClient } from "mongodb";
import { glob } from "glob";
import { protectConfig } from "../src/content/consts.ts";

async function uploadPasswords() {
  const MONGO_URI = process.env.MONGO_URI;
  const DB_NAME = "theme_memories";
  const COLLECTION_NAME = "hashpwd";

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Find all markdown files in public and private content folders
    const files = await glob("src/content/private/**/*.{md,mdx}");

    const updates = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const { data } = matter(content);
      let passwordRaw;

      if (!data.password) {
        passwordRaw = protectConfig.password;
      } else {
        passwordRaw = data.password;
      }
      const slug = data.slug;
      const hashedPassword = await argon2.hash(passwordRaw);

      updates.push({
        slug,
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      });
    }

    if (updates.length === 0) {
      console.log("No protected posts with passwords found.");
      return;
    }

    for (const update of updates) {
      await collection.updateOne(
        { slug: update.slug },
        { $set: update },
        { upsert: true },
      );
    }

    console.log("Successfully uploaded all hashed passwords.");
  } catch (error) {
    console.error("Error uploading passwords:", error);
  } finally {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

uploadPasswords();
