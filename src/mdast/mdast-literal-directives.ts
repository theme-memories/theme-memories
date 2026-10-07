/*
 * Only container directives (`:::note`) carry meaning on this site. Sätteri's
 * `directive` feature also parses text (`:name[content]`) and leaf
 * (`::name[content]`) directives, and it reads a bare `:word` as a text
 * directive — so ordinary prose like `17:00` or `a:b` would otherwise have its
 * tail swallowed, and neither form has an element to render into.
 *
 * This rewrites both back to the exact source they came from, so a stray colon
 * is preserved and the only directive that has to be handled is the container
 * form in `mdast-alerts.ts`.
 */
import { defineMdastPlugin } from "satteri";
import type { MdastNode, MdastVisitorContext } from "satteri";

type DirectiveNode = Extract<
  MdastNode,
  { type: "textDirective" | "leafDirective" }
>;

const literal = (
  node: Readonly<DirectiveNode>,
  context: MdastVisitorContext,
) => {
  const { position } = node;
  if (position?.start.offset === undefined || position.end.offset === undefined)
    return;

  return {
    type: "text" as const,
    value: context.source.slice(position.start.offset, position.end.offset),
  };
};

export const mdastLiteralDirectivesPlugin = defineMdastPlugin({
  name: "mdast-literal-directives",
  options: { position: true },
  textDirective: literal,
  leafDirective: literal,
});
