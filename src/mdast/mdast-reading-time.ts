import getReadingTime from "reading-time";
import { defineMdastPlugin } from "satteri";

export const mdastReadingTimePlugin = defineMdastPlugin({
  name: "mdast-reading-time",
  after(root, context) {
    const textOnPage = context.textContent(root);
    const readingTime = getReadingTime(textOnPage);

    if (context.data.astro !== undefined) {
      // `readingTime.text` would give the English string, "3 min read". The
      // article metadata is rendered in Japanese, so the count is formatted
      // here instead and the reader sees 読了 / 3分.
      context.data.astro.frontmatter.minutesRead = `${Math.round(readingTime.minutes)}分`;
    }
  },
});
