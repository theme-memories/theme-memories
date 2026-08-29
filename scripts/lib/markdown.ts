// Shared markdown rendering for vault posts (used by post-prepare.ts).
//
// The plugin/feature set is fixed on purpose so rendered envelopes are reproducible
// across builds. renderMarkdown returns the HTML, extracted heading anchors, and
// the raw frontmatter (parsed separately by lib/frontmatter.ts).
import { markdownToHtml } from "satteri";
import type { Frontmatter } from "satteri";
import expressiveCode from "satteri-expressive-code";
import type { SatteriExpressiveCodeOptions } from "satteri-expressive-code";
import { satteriPangu } from "../../src/lib/satteri-pangu.ts";
import { sectionize } from "../../src/lib/satteri-sectionize.ts";
import { katex } from "../../src/lib/satteri-katex.ts";
import satteriDirective from "../../src/lib/satteri-directive.ts";
import { satteriGithubAlerts } from "../../src/lib/satteri-github-alerts.ts";
import satteriSanitize from "../../src/lib/satteri-sanitize.ts";
import { satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import ecConfig from "../../ec.config.mjs";

export const FEATURES = {
  gfm: {
    footnotes: {
      label: "注釈",
      backContent: "↑",
      backLabel: "注釈{reference}に戻る",
    },
  },
  math: true,
  directive: true,
  definitionList: true,
  smartPunctuation: true,
} as const;

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: Heading[];
  frontmatter: Frontmatter | null;
}

export async function renderMarkdown(
  source: string,
  options: { fileURL?: URL } = {},
): Promise<RenderedMarkdown> {
  const { html: raw, frontmatter } = await markdownToHtml(source, {
    mdastPlugins: [satteriPangu(), sectionize(), katex(), satteriDirective()],
    hastPlugins: [
      satteriGithubAlerts(),
      satteriHeadingIdsPlugin(),
      satteriSanitize(),
      expressiveCode(ecConfig as SatteriExpressiveCodeOptions),
    ],
    features: FEATURES,
    ...(options.fileURL ? { fileURL: options.fileURL } : {}),
  });

  const headings: Heading[] = [];
  const headingRe = /<h([1-6]) id="([^"]*)"[^>]*>([^<]*)<\/h\1>/g;
  for (const match of raw.matchAll(headingRe)) {
    const depth = Number(match[1]);
    const slug = match[2];
    const text = match[3];
    if (depth && slug) headings.push({ depth, slug, text });
  }

  return { html: raw, headings, frontmatter };
}
