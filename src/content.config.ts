import { needsRehash } from "argon2";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { DEFAULT_VAULT_QUESTION, VAULT_ARGON2_OPTIONS } from "./consts";
import { categoryKeys } from "./data/categories";

const isVaultPasswordHash = (hash: string) => {
  if (!hash.startsWith("$argon2id$")) return false;
  try {
    return !needsRehash(hash, VAULT_ARGON2_OPTIONS);
  } catch {
    return false;
  }
};

const article = defineCollection({
  loader: glob({ base: "./src/content/article", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      slug: z.string(),
      category: z.enum(categoryKeys),
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      pinned: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

const vault = defineCollection({
  loader: glob({ base: "./src/content/vault", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      slug: z.string(),
      category: z.enum(categoryKeys),
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      pinned: z.literal(false).default(false),
      draft: z.boolean().default(false),
      question: z.string().default(DEFAULT_VAULT_QUESTION),
      passwordHash: z.string().refine(isVaultPasswordHash, {
        message: `Must be an argon2id hash with memoryCost=${VAULT_ARGON2_OPTIONS.memoryCost}, timeCost=${VAULT_ARGON2_OPTIONS.timeCost} and parallelism=${VAULT_ARGON2_OPTIONS.parallelism}`,
      }),
    }),
});

export const collections = { article, vault };
