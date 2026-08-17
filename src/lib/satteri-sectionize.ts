/*
Derived from upstream: https://github.com/baka-gourd/satteri-plugins/blob/main/packages/satteri-sectionize/src/index.ts
Latest update: 2026-06-24 15:26 UTC with commit f3a9caf
Custom logic added to support footnotes
*/

import {
  defineMdastPlugin,
  type MdastNode,
  type MdastPluginDefinition,
} from "satteri";

export interface SectionizeOptions {
  maxDepth?: number;
}

type HeadingNode = Extract<MdastNode, { type: "heading" }>;
type BlockquoteNode = Extract<MdastNode, { type: "blockquote" }>;

export interface SectionData {
  hName: "section";
  depth: number;
}

export type SectionNode = BlockquoteNode & {
  data: SectionData;
};

interface OpenSection {
  depth: number;
  children: MdastNode[];
}

const defaultMaxDepth = 6;

function isSectionHeading(
  node: Readonly<MdastNode>,
  maxDepth: number,
): node is Readonly<HeadingNode> {
  return node.type === "heading" && node.depth <= maxDepth;
}

function createSection(depth: number, children: MdastNode[]): SectionNode {
  return {
    type: "blockquote",
    data: { hName: "section", depth },
    children: children as SectionNode["children"],
  };
}

export function isSectionNode(
  node: Readonly<MdastNode>,
): node is Readonly<SectionNode> {
  const data = node.data as Record<string, unknown> | undefined;

  return (
    node.type === "blockquote" &&
    data?.hName === "section" &&
    typeof data.depth === "number"
  );
}

function sectionizeChildren(
  children: readonly MdastNode[],
  maxDepth: number,
): MdastNode[] {
  const result: MdastNode[] = [];
  const sections: OpenSection[] = [];

  for (const child of children) {
    if (child.type === "mdxjsEsm") {
      sections.length = 0;
      result.push(child);
      continue;
    }

    if (child.type === "footnoteDefinition") {
      result.push(child);
      continue;
    }

    if (!isSectionHeading(child, maxDepth)) {
      (sections.at(-1)?.children ?? result).push(child);
      continue;
    }

    while (sections.length > 0 && sections.at(-1)!.depth >= child.depth) {
      sections.pop();
    }

    const sectionChildren: MdastNode[] = [child];
    (sections.at(-1)?.children ?? result).push(
      createSection(child.depth, sectionChildren),
    );
    sections.push({ depth: child.depth, children: sectionChildren });
  }

  return result;
}

function firstSectionHeadingIndex(
  children: readonly MdastNode[],
  maxDepth: number,
) {
  return children.findIndex((child) => isSectionHeading(child, maxDepth));
}

export function sectionize(
  options: SectionizeOptions = {},
): MdastPluginDefinition {
  const maxDepth = options.maxDepth ?? defaultMaxDepth;
  const processedParents = new WeakSet<object>();

  return defineMdastPlugin({
    name: "sectionize",
    heading(node, ctx) {
      if (!isSectionHeading(node, maxDepth)) {
        return;
      }

      const parent = ctx.parent(node);
      const index = ctx.indexOf(node);

      if (
        index === undefined ||
        processedParents.has(parent) ||
        index !== firstSectionHeadingIndex(parent.children, maxDepth)
      ) {
        return;
      }

      processedParents.add(parent);
      ctx.setProperty(
        parent,
        "children",
        sectionizeChildren(parent.children, maxDepth),
      );
    },
  });
}
