import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const article = defineCollection({
  loader: glob({
    pattern: "**/index.md",
    base: "./src/content/article",
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    publishedAt: z.string(),
    displayDate: z.string().optional(),
    category: z.enum([
      "announce",
      "campaign",
      "important",
      "message",
      "other",
      "update",
    ]),
    thumb: z.string(),
    description: z.string(),
    pinned: z.boolean().default(false),
    draft: z.boolean().default(true),
    protected: z.boolean().default(true),
    question: z.string().optional(),
    password: z.string().optional(),
  }),
});

const vault = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/vault-json",
  }),
  schema: z.object({
    slug: z.string(),
    publishedAt: z.string(),
    displayDate: z.string().optional(),
    category: z.enum([
      "announce",
      "campaign",
      "important",
      "message",
      "other",
      "update",
    ]),
    questionHtml: z.string().optional(),
  }),
});

export const collections = { article, vault };
