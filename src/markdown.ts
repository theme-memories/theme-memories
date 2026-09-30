import { hastEagerImages } from "./hast/hast-eager-images";
import { hastSanitize } from "./hast/hast-sanitize";
import { hastTaskListLabels } from "./hast/hast-task-list-labels";
import { mdastKatexPlugin } from "./mdast/mdast-katex";
import { mdastReadingTimePlugin } from "./mdast/mdast-reading-time";
import type { Features } from "satteri";

export const markdownFeatures = {
  gfm: {
    footnotes: {
      label: "注釈",
      backContent: "↑",
      backLabel: "注釈{reference}に戻る",
    },
  },
  math: true,
  smartPunctuation: true,
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
 */
export const markdownMdastPlugins = [mdastReadingTimePlugin, mdastKatexPlugin];

export const markdownHastPlugins = [
  hastEagerImages,
  hastSanitize,
  hastTaskListLabels,
];
