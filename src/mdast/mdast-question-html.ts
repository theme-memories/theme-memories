import { defineMdastPlugin, markdownToHtml } from "satteri";
import {
  markdownFeatures,
  markdownHastPlugins,
  markdownMdastPlugins,
} from "../markdown";
import { renderQuestionHtml } from "./question-html";

/*
 * A question is the one field of a locked post that is rendered to HTML on a
 * public page, and it is compiled on its own — so it is given the same plugin
 * set as a post body, rather than the feature flags alone. Without that, maths
 * in a question stayed the `language-math` code block Sätteri emits when no
 * plugin renders it, while the same source rendered as KaTeX in a body.
 */
const renderMarkdown = (markdown: string) =>
  markdownToHtml(markdown, {
    features: markdownFeatures,
    mdastPlugins: markdownMdastPlugins,
    hastPlugins: markdownHastPlugins,
  }).html;

export const mdastQuestionHtmlPlugin = defineMdastPlugin({
  name: "mdast-question-html",
  after(_root, context) {
    const frontmatter = context.data.astro?.frontmatter;
    if (frontmatter === undefined) return;

    renderQuestionHtml(frontmatter, renderMarkdown);
  },
});
