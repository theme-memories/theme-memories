import { describe, expect, it } from "vitest";
import {
  FILTER_ALL,
  getPostYears,
  matchesPostFilter,
  toFilterablePost,
  type FilterablePost,
} from "../src/utils/post-filter";

const post = (
  category: FilterablePost["category"],
  year: number,
): FilterablePost => ({ category, year });

describe("toFilterablePost", () => {
  it("reads the category and the publication year from an entry", () => {
    const entry = {
      data: { category: "notes" as const, pubDate: new Date("2023-11-02") },
    };

    expect(toFilterablePost(entry)).toEqual({ category: "notes", year: 2023 });
  });
});

describe("getPostYears", () => {
  it("returns nothing when there are no posts", () => {
    expect(getPostYears([])).toEqual([]);
  });

  it("lists each year once, newest first", () => {
    const years = getPostYears([
      post("tech", 2022),
      post("life", 2024),
      post("notes", 2022),
    ]);

    expect(years).toEqual([2024, 2022]);
  });

  it("sorts years numerically rather than lexically", () => {
    expect(getPostYears([post("tech", 1999), post("tech", 2024)])).toEqual([
      2024, 1999,
    ]);
  });
});

describe("matchesPostFilter", () => {
  const entry = post("tech", 2024);

  it("matches everything with the default filter", () => {
    expect(
      matchesPostFilter(entry, { category: FILTER_ALL, year: FILTER_ALL }),
    ).toBe(true);
  });

  it("matches on category alone", () => {
    expect(
      matchesPostFilter(entry, { category: "tech", year: FILTER_ALL }),
    ).toBe(true);
    expect(
      matchesPostFilter(entry, { category: "life", year: FILTER_ALL }),
    ).toBe(false);
  });

  it("matches on year alone", () => {
    expect(matchesPostFilter(entry, { category: FILTER_ALL, year: 2024 })).toBe(
      true,
    );
    expect(matchesPostFilter(entry, { category: FILTER_ALL, year: 2022 })).toBe(
      false,
    );
  });

  it("requires both filters to match", () => {
    expect(matchesPostFilter(entry, { category: "tech", year: 2024 })).toBe(
      true,
    );
    expect(matchesPostFilter(entry, { category: "tech", year: 2022 })).toBe(
      false,
    );
    expect(matchesPostFilter(entry, { category: "life", year: 2024 })).toBe(
      false,
    );
  });
});
