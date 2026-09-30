import { getCollection, type CollectionEntry } from "astro:content";

type Post = CollectionEntry<"article"> | CollectionEntry<"vault">;

export const getArticles = () =>
  getCollection("article", ({ data }) => !data.draft);

export const getVaultEntries = () =>
  getCollection("vault", ({ data }) => !data.draft);

export const getVaultEntry = async (slug: string) =>
  (await getVaultEntries()).find((entry) => entry.data.slug === slug);

export const byPinnedThenDate = (a: Post, b: Post) => {
  if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
};
