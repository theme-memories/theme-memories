/*
Fork of upstream: https://github.com/felixicaza/satteri-plugins/blob/main/packages/directive/src
Latest update: 2026-06-25 19:31 UTC with commit 32eef6d
Custom logic added to drop text/leaf directive
*/

import { defineMdastPlugin } from "satteri";
import type { MdastPluginDefinition, MdastVisitorContext } from "satteri";

export type MdastPluginDefinitionLike = MdastPluginDefinition;
export type ContainerDirective = Parameters<
  NonNullable<MdastPluginDefinition["containerDirective"]>
>[0];
export type LeafDirective = Parameters<
  NonNullable<MdastPluginDefinition["leafDirective"]>
>[0];
export type TextDirective = Parameters<
  NonNullable<MdastPluginDefinition["textDirective"]>
>[0];
export type HastProps = Record<string, unknown>;
export type DirectiveAttributes =
  Record<string, string | null | undefined> | null | undefined;

const SAFE_DIRECTIVE_TAGS = new Set([
  "aside",
  "article",
  "caution",
  "div",
  "important",
  "note",
  "section",
  "tip",
  "warning",
]);

const SAFE_DIRECTIVE_ATTRIBUTES = new Set([
  "class",
  "className",
  "id",
  "title",
  "role",
  "dir",
  "lang",
]);

function isSafeDirectiveAttribute(key: string): boolean {
  return (
    SAFE_DIRECTIVE_ATTRIBUTES.has(key) ||
    key.startsWith("aria-") ||
    key.startsWith("data-")
  );
}

export function directiveAttrsToHastProps(
  attributes: DirectiveAttributes,
): HastProps {
  const props: HastProps = {};

  if (!attributes) return props;

  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    if (!isSafeDirectiveAttribute(key)) continue;

    if (key === "class" || key === "className") {
      props.className = value.split(/\s+/).filter(Boolean);
      continue;
    }

    props[key] = value;
  }

  return props;
}

export function setDirectiveData<
  T extends ContainerDirective | LeafDirective | TextDirective,
>(node: T, hName: string, hProperties: HastProps = {}): T {
  return {
    ...node,
    data: { hName, hProperties },
  };
}

type DirectiveNode = ContainerDirective | LeafDirective | TextDirective;

function handleDirective(node: DirectiveNode) {
  const tagName = node.name.toLowerCase();
  return setDirectiveData(
    node,
    SAFE_DIRECTIVE_TAGS.has(tagName) ? tagName : "div",
    directiveAttrsToHastProps(node.attributes),
  );
}

function literalFromPosition(
  ctx: MdastVisitorContext,
  node: Readonly<LeafDirective | TextDirective>,
): string | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start == null || end == null) return undefined;
  const literal = Buffer.from(ctx.source).subarray(start, end).toString();
  if (literal.includes("\uFFFD")) return undefined;
  return literal;
}

function serializeAttributes(attributes: DirectiveAttributes): string {
  if (!attributes) return "";
  const entries = Object.entries(attributes)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}="${value}"`);
  return entries.length > 0 ? `{${entries.join(" ")}}` : "";
}

function literalFromParts(
  node: Readonly<LeafDirective | TextDirective>,
  ctx: MdastVisitorContext,
): string {
  const prefix = node.type === "leafDirective" ? "::" : ":";
  const attrs = serializeAttributes(node.attributes);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const content = hasChildren ? `[${ctx.textContent(node)}]` : "";
  return `${prefix}${node.name}${attrs}${content}`;
}

function literal(
  node: Readonly<LeafDirective | TextDirective>,
  ctx: MdastVisitorContext,
): string {
  return literalFromPosition(ctx, node) ?? literalFromParts(node, ctx);
}

export default function satteriDirective(): MdastPluginDefinitionLike {
  return defineMdastPlugin({
    name: "satteri-directive",
    containerDirective: handleDirective,
    leafDirective(node, ctx) {
      return {
        type: "paragraph",
        children: [{ type: "text", value: literal(node, ctx) }],
      };
    },
    textDirective(node, ctx) {
      return { type: "text", value: literal(node, ctx) };
    },
  });
}
