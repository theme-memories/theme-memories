/*
Fork of upstream: https://github.com/vincentbel/remark-pangu/blob/master/index.js
Latest update: 2020-05-04 05:55 UTC with commit 532ab83
Converted to satteri plugin
*/

import { defineMdastPlugin } from "satteri";
import type { MdastPluginDefinition } from "satteri";
import pangu from "pangu";

function maybeSpace<T extends string | null | undefined>(value: T): T {
  if (!value) return value;
  const spaced = pangu.spacingText(value);
  return spaced === value ? value : (spaced as T);
}

export function satteriPangu(): MdastPluginDefinition {
  return defineMdastPlugin({
    name: "satteri-pangu",
    text(node, ctx) {
      const value = pangu.spacingText(node.value);
      if (value !== node.value) {
        ctx.setProperty(node, "value", value);
      }
    },
    image(node, ctx) {
      const alt = maybeSpace(node.alt);
      const title = maybeSpace(node.title);
      if (alt !== node.alt) ctx.setProperty(node, "alt", alt);
      if (title !== node.title) ctx.setProperty(node, "title", title);
    },
    imageReference(node, ctx) {
      const alt = maybeSpace(node.alt);
      if (alt !== node.alt) ctx.setProperty(node, "alt", alt);
    },
    link(node, ctx) {
      const title = maybeSpace(node.title);
      if (title !== node.title) ctx.setProperty(node, "title", title);
    },
    definition(node, ctx) {
      const title = maybeSpace(node.title);
      if (title !== node.title) ctx.setProperty(node, "title", title);
    },
  });
}
