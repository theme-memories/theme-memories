import rss from "@astrojs/rss";
import { getPublishedPosts } from "../lib/articles";

export async function GET(context: { site: string }) {
  return rss({
    title: "Theme Memories — Project SEKAI まとめ",
    description:
      "プロジェクトセカイ（プロセカ）の公式ニュース・お知らせをまとめたブログです。",
    site: context.site,
    items: (await getPublishedPosts()).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.publishedAt),
      link: `/article/${post.data.slug}`,
    })),
  });
}
