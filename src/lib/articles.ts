import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import readingTime from "reading-time";
import { vault } from "../config";
import vaultPlaceholder from "../assets/hero/bg-pc.webp?url";

export type Article = CollectionEntry<"article">;
export type VaultPost = CollectionEntry<"vault">;
export type Category = Article["data"]["category"];

export const readingTimeText = (post: Article): string => {
  const { minutes, words } = readingTime(post.body ?? "", {
    wordsPerMinute: 400,
  });
  const readMinutes = Math.max(Math.ceil(minutes), 1);
  const prefix = post.data.displayDate
    ? `${formatDate(post.data.displayDate)}更新・`
    : "";
  return `${prefix}${words}文字・約${readMinutes}分で読めます`;
};

const thumbMap = import.meta.glob<string>("../content/article/*/*", {
  eager: true,
  query: "?url",
  import: "default",
});

export const thumbFor = (post: Article): string =>
  thumbMap[`../content/article/${post.data.slug}/${post.data.thumb}`] ??
  post.data.thumb;

export const postDate = (post: Article): string =>
  post.data.displayDate ?? post.data.publishedAt;

export const formatDate = (ts: string): string => {
  const [y, m, d] = ts.slice(0, 10).split("-");
  return `${+y}.${+m}.${+d}`;
};

export const formatMonth = (ts: string): string => {
  const [y, m] = ts.slice(0, 10).split("-");
  return `${+y}.${+m}`;
};

export const postYear = (post: Article): number =>
  Number(post.data.publishedAt.slice(0, 4));

export const sortByDateDesc = (a: Article, b: Article): number =>
  postDate(a) < postDate(b) ? 1 : postDate(a) > postDate(b) ? -1 : 0;

export async function getPublishedPosts(): Promise<Article[]> {
  const posts = await getCollection("article");

  const violations: string[] = [];
  for (const post of posts) {
    if (post.data.draft === true) continue;
    if (post.data.protected === true) {
      violations.push(
        `${post.data.slug}: "protected" must not be true on articles`,
      );
    }
    if (post.data.question) {
      violations.push(`${post.data.slug}: "question" is not allowed`);
    }
    if (post.data.password) {
      violations.push(`${post.data.slug}: "password" is not allowed`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `invalid article frontmatter:\n  - ${violations.join("\n  - ")}`,
    );
  }

  return posts.filter((post) => post.data.draft === false).sort(sortByDateDesc);
}

export async function getVaultPosts(): Promise<VaultPost[]> {
  const posts = await getCollection("vault");
  return posts.sort((a, b) =>
    postDateVault(a) < postDateVault(b)
      ? 1
      : postDateVault(a) > postDateVault(b)
        ? -1
        : 0,
  );
}

const postDateVault = (post: VaultPost): string =>
  post.data.displayDate ?? post.data.publishedAt;

export interface FeedItem {
  slug: string;
  title: string;
  publishedAt: string;
  category: Category;
  thumb: string;
  href: string;
  year: number;
  dateLabel: string;
  protected: boolean;
}

export async function getFeedPosts(): Promise<FeedItem[]> {
  const [articles, vaultPosts] = await Promise.all([
    getPublishedPosts(),
    getVaultPosts(),
  ]);

  const items: FeedItem[] = [
    ...articles.map((post) => ({
      slug: post.data.slug,
      title: post.data.title,
      publishedAt: post.data.publishedAt,
      category: post.data.category,
      thumb: thumbFor(post),
      href: `/article/${post.data.slug}`,
      year: postYear(post),
      dateLabel: formatDate(post.data.publishedAt),
      protected: false,
    })),
    ...vaultPosts.map((post) => ({
      slug: post.data.slug,
      title: vault.genericTitle,
      publishedAt: post.data.publishedAt,
      category: post.data.category,
      thumb: vaultPlaceholder,
      href: `/vault/${post.data.slug}`,
      year: Number(post.data.publishedAt.slice(0, 4)),
      dateLabel: formatMonth(post.data.publishedAt),
      protected: true,
    })),
  ];

  return items.sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0,
  );
}
