import { describe, expect, it } from "vitest";
import { buildToc } from "../src/utils/toc";

const heading = (depth: number, text: string) => ({
  depth,
  slug: text.toLowerCase().replace(/\s+/g, "-"),
  text,
});

describe("buildToc", () => {
  it("returns nothing when there are no headings", () => {
    expect(buildToc([])).toEqual([]);
  });

  it("lists h2 headings at the top level", () => {
    const toc = buildToc([heading(2, "One"), heading(2, "Two")]);

    expect(toc.map((item) => item.heading.text)).toEqual(["One", "Two"]);
    expect(toc.every((item) => item.children.length === 0)).toBe(true);
  });

  it("nests h3 headings under the preceding h2", () => {
    const toc = buildToc([
      heading(2, "One"),
      heading(3, "One A"),
      heading(3, "One B"),
      heading(2, "Two"),
      heading(3, "Two A"),
    ]);

    expect(toc.map((item) => item.heading.text)).toEqual(["One", "Two"]);
    expect(toc[0].children.map((child) => child.text)).toEqual([
      "One A",
      "One B",
    ]);
    expect(toc[1].children.map((child) => child.text)).toEqual(["Two A"]);
  });

  it("drops the h1 title and headings deeper than h3", () => {
    const toc = buildToc([
      heading(1, "Title"),
      heading(4, "Deep"),
      heading(2, "Section"),
    ]);

    expect(toc.map((item) => item.heading.text)).toEqual(["Section"]);
    expect(toc[0].children).toEqual([]);
  });

  it("keeps a document that starts at h3 flat", () => {
    const toc = buildToc([heading(3, "One"), heading(3, "Two")]);

    expect(toc.map((item) => item.heading.text)).toEqual(["One", "Two"]);
    expect(toc.every((item) => item.children.length === 0)).toBe(true);
  });
});
