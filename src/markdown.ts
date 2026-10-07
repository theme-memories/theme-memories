import { hastEagerImages } from "./hast/hast-eager-images";
import { hastSanitize } from "./hast/hast-sanitize";
import { hastTaskListLabels } from "./hast/hast-task-list-labels";
import { mdastAdmonitionsPlugin } from "./mdast/mdast-admonitions";
import { mdastAlertsPlugin } from "./mdast/mdast-alerts";
import { mdastExtendedTablePlugin } from "./mdast/mdast-extended-table";
import { mdastKatexPlugin } from "./mdast/mdast-katex";
import { mdastLiteralDirectivesPlugin } from "./mdast/mdast-literal-directives";
import { mdastReadingTimePlugin } from "./mdast/mdast-reading-time";
import type { Features } from "satteri";

/*
 * `gfm` carries tables, footnotes, strikethrough and task lists; the flags
 * beside it are the extensions Sätteri keeps off by default. `superscript` and
 * `subscript` take the caret and single-tilde runs; `directive` adds `:::`
 * blocks, `wikilinks` adds `[[…]]`, `definitionList` adds the term/definition
 * pair, and `headingAttributes` lets a heading carry its own `{#id .class}`.
 *
 * `math.singleDollarTextMath: false` keeps a lone `$` as text — a post about
 * prices would otherwise read `$50` and `$60` as one expression — while `$$…$$`
 * still sets display math and a single-line `$$…$$` still sets inline math.
 */
export const markdownFeatures = {
  gfm: {
    footnotes: {
      label: "注釈",
      backContent: "↑",
      backLabel: "注釈{reference}に戻る",
    },
  },
  math: { singleDollarTextMath: false },
  smartPunctuation: true,
  superscript: true,
  subscript: true,
  directive: true,
  wikilinks: true,
  definitionList: true,
  headingAttributes: true,
} satisfies Features;

/*
 * What turns authored Markdown into what the page renders.
 *
 * Shared, because more than one compile produces content: a post body, and the
 * vault question, which is rendered from its own frontmatter into HTML. The
 * question used to be compiled with the feature flags alone, which left `$2 + 2$`
 * as the `language-math` code block Sätteri emits for maths nobody has rendered.
 *
 * `mdastQuestionHtmlPlugin` is deliberately absent: it is the plugin that
 * renders a question, so it cannot also be part of the set a question is
 * rendered with. The reading-time write a question compile makes lands in that
 * compile's own data bag and goes nowhere.
 *
 * The order matters in one place: `mdastAdmonitionsPlugin` rewrites a GitHub
 * alert into a container directive, and `mdastAlertsPlugin` is what renders that
 * directive, so the former has to run first.
 */
export const markdownMdastPlugins = [
  mdastReadingTimePlugin,
  mdastKatexPlugin,
  mdastAdmonitionsPlugin,
  mdastAlertsPlugin,
  mdastLiteralDirectivesPlugin,
  mdastExtendedTablePlugin(),
];

export const markdownHastPlugins = [
  hastEagerImages,
  hastSanitize,
  hastTaskListLabels,
];
