import type { CategoryKey } from "../data/categories";

/** Group value that leaves the group unrestricted. */
export const FILTER_ALL = "all";

export type CategoryFilter = CategoryKey | typeof FILTER_ALL;
type YearFilter = number | typeof FILTER_ALL;

export interface PostFilter {
  category: CategoryFilter;
  year: YearFilter;
}

/** The post fields the filter matches on, normalised from any collection entry. */
export interface FilterablePost {
  category: CategoryKey;
  year: number;
}

export const toFilterablePost = (post: {
  data: { category: CategoryKey; pubDate: Date };
}): FilterablePost => ({
  category: post.data.category,
  year: post.data.pubDate.getFullYear(),
});

/** The years the posts are published in, newest first. */
export const getPostYears = (posts: FilterablePost[]): number[] =>
  [...new Set(posts.map((post) => post.year))].sort((a, b) => b - a);

export const matchesPostFilter = (
  post: FilterablePost,
  filter: PostFilter,
): boolean =>
  (filter.category === FILTER_ALL || post.category === filter.category) &&
  (filter.year === FILTER_ALL || post.year === filter.year);
