/*
 * Category marks are fixed rather than theme-bound. A category label has to
 * read on paper and on ink alike, so each one sits at a lightness that clears
 * both backgrounds instead of flipping with the theme.
 *
 * The three hues are Japanese pigments — 藍, 紅, 黄土 — which is why they are
 * named here rather than borrowed from the Tailwind palette. They are a
 * reinforcement only: the label beside the mark always carries the meaning.
 */
export const categories = {
  tech: {
    name: "技術",
    dot: "bg-[oklch(0.55_0.09_250)]",
  },
  life: {
    name: "生活",
    dot: "bg-[oklch(0.57_0.13_20)]",
  },
  notes: {
    name: "雑記",
    dot: "bg-[oklch(0.63_0.1_76)]",
  },
} as const;

export type CategoryKey = keyof typeof categories;

export const categoryKeys = Object.keys(categories) as [
  CategoryKey,
  ...CategoryKey[],
];
