/*
 * Vendored from `satteri-extended-table` (satteri-plugins), MIT © baka-gourd —
 * https://github.com/baka-gourd/satteri-plugins/tree/main/packages/satteri-extended-table
 *
 * The package is itself a thin wrapper: the syntax lives in
 * `micromark-extension-extended-table` and the mdast conversion in
 * `mdast-util-extended-table`, both from the remark-extended-table project. The
 * wrapper is copied here instead of adding the satteri-plugins package; those
 * two parser packages are declared in `package.json`.
 *
 * Sätteri has no native extended-table feature, so this plugin re-parses each
 * table's own source through the remark-extended-table stack and renders the
 * result as raw HTML, which is why it is registered as an MDAST plugin — the
 * table node reaches the plugin before conversion, and the emitted HTML then
 * flows through the sanitiser like any other raw HTML.
 */
import { toHtml } from "hast-util-to-html";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
  extendedTableFromMarkdown,
  extendedTableHandlers,
  type extendedTableFromMarkdownOptions,
} from "mdast-util-extended-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { toHast } from "mdast-util-to-hast";
import { extendedTable as micromarkExtendedTable } from "micromark-extension-extended-table";
import { gfmTable } from "micromark-extension-gfm-table";
import { defineMdastPlugin } from "satteri";
import type { MdastNode } from "satteri";

export type ExtendedTableOptions = extendedTableFromMarkdownOptions;

type TableNode = Extract<MdastNode, { type: "table" }>;

/**
 * The table's own slice of the source, recovered from its position: the plugin
 * re-parses it so the extended markers are interpreted by the remark stack
 * rather than by Sätteri's table parser, which does not know them.
 */
const sliceSource = (source: string, node: TableNode): string | undefined => {
  if (!node.position) return undefined;
  return source.slice(node.position.start.offset, node.position.end.offset);
};

const renderExtendedTable = (
  markdown: string,
  options?: ExtendedTableOptions,
): string => {
  const tree = fromMarkdown(markdown, {
    extensions: [gfmTable(), micromarkExtendedTable],
    mdastExtensions: [
      gfmTableFromMarkdown(),
      extendedTableFromMarkdown(options),
    ],
  });

  return toHtml(toHast(tree, { handlers: extendedTableHandlers }));
};

/** A whole cell being `^` or `>` is the signal that a merge is wanted. */
const hasMergeMarker = (markdown: string): boolean =>
  markdown
    .split("\n")
    .some((line) =>
      line
        .split("|")
        .some((cell) => cell.trim() === "^" || cell.trim() === ">"),
    );

/**
 * Extended table syntax, as implemented by remark-extended-table:
 *
 * - `^` merges with the cell above it and creates a `rowspan`.
 * - `>` merges with the cell to the right and creates a `colspan`.
 * - An empty cell merges with its left neighbour when `colspanWithEmpty` is on.
 *
 * Only a table that uses one of those markers is handed to the remark stack,
 * because that stack does not carry the site's own extensions — maths,
 * footnotes, sub- and superscript among them. A plain table is left to
 * Sätteri's conversion, which does.
 */
export const mdastExtendedTablePlugin = (options?: ExtendedTableOptions) =>
  defineMdastPlugin({
    name: "mdast-extended-table",
    options: { position: true },
    table(node, context) {
      const markdown = sliceSource(context.source, node);
      if (!markdown || !hasMergeMarker(markdown)) return;

      return {
        raw: renderExtendedTable(markdown, options),
        mdxExpressions: false,
      };
    },
  });
