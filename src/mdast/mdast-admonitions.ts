/*
 * Vendored from `satteri-admonitions-to-directives` (satteri-plugins), MIT ©
 * baka-gourd —
 * https://github.com/baka-gourd/satteri-plugins/tree/main/packages/satteri-admonitions-to-directives
 *
 * A GitHub alert (`> [!NOTE]`) is a blockquote whose first line is a marker.
 * This rewrites it into the container-directive node Sätteri already parses for
 * `:::note`, so `mdast-alerts.ts` renders both spellings through one path and
 * the feature is a real directive either way.
 */
import { defineMdastPlugin } from "satteri";
import type { MdastNode } from "satteri";

const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

type AlertType = (typeof ALERT_TYPES)[number];
type BlockquoteNode = Extract<MdastNode, { type: "blockquote" }>;
type ParagraphNode = Extract<MdastNode, { type: "paragraph" }>;
type ContainerDirectiveNode = Extract<
  MdastNode,
  { type: "containerDirective" }
>;

/** The directive name each GitHub alert type maps onto. */
const MAPPING: Readonly<Record<AlertType, string>> = {
  NOTE: "note",
  TIP: "tip",
  IMPORTANT: "info",
  WARNING: "warning",
  CAUTION: "danger",
};

const DECLARATION = /^\s*\[!(?<type>\w+)\]\s*$/;

const isAlertType = (value: unknown): value is AlertType =>
  typeof value === "string" &&
  (ALERT_TYPES as readonly string[]).includes(value);

const toDirective = (
  node: Readonly<BlockquoteNode>,
): ContainerDirectiveNode | undefined => {
  const [firstChild, ...rest] = node.children;
  if (firstChild?.type !== "paragraph") return undefined;

  const [declaration, ...inlineChildren] = firstChild.children;
  if (declaration?.type !== "text") return undefined;

  const [marker, ...lines] = declaration.value.split("\n");
  const type = marker?.match(DECLARATION)?.groups?.type;
  if (!isAlertType(type)) return undefined;

  /*
   * The text after the marker shares the paragraph with it, so it is rebuilt
   * into a paragraph of its own; a marker-only alert drops the paragraph
   * entirely and keeps only what followed the blockquote.
   */
  const body: ParagraphNode | undefined =
    lines.length > 0 || inlineChildren.length > 0
      ? {
          type: "paragraph",
          children: [
            ...(lines.length > 0
              ? [{ type: "text" as const, value: lines.join("\n") }]
              : []),
            ...inlineChildren,
          ],
        }
      : undefined;

  return {
    type: "containerDirective",
    name: MAPPING[type],
    children: body ? [body, ...rest] : rest,
  } as ContainerDirectiveNode;
};

export const mdastAdmonitionsPlugin = defineMdastPlugin({
  name: "mdast-admonitions",
  blockquote(node) {
    return toDirective(node);
  },
});
