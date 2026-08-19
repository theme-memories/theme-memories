import {
  defineHastPlugin,
  type HastNode,
  type HastPluginDefinition,
} from "satteri";

type Element = Extract<HastNode, { type: "element" }>;

type AlertSpec = { title: string; icon: string };

function toClassList(className: Element["properties"]["className"]): string[] {
  return Array.isArray(className) ? className : [];
}

const ALERTS: Record<string, AlertSpec> = {
  note: { title: "メモ", icon: "info" },
  tip: { title: "ヒント", icon: "lightbulb" },
  important: { title: "重要", icon: "priority_high" },
  warning: { title: "警告", icon: "warning_amber" },
  caution: { title: "注意", icon: "error" },
};

const SAFE_ALERT_PROPERTIES = new Set([
  "id",
  "role",
  "dir",
  "lang",
  "ariaDescribedBy",
  "ariaHidden",
  "ariaLabel",
  "ariaLabelledBy",
  "data-alert",
]);

function buildTitle(spec: AlertSpec, title: string): Element {
  return {
    type: "element",
    tagName: "p",
    properties: { className: ["markdown-alert-title"] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["markdown-alert-icon"], ariaHidden: "true" },
        children: [{ type: "text", value: spec.icon }],
      },
      { type: "text", value: title },
    ],
  };
}

export function satteriGithubAlerts(): HastPluginDefinition {
  return defineHastPlugin({
    name: "satteri-github-alerts",
    element: {
      filter: ["note", "tip", "important", "warning", "caution"],
      visit(node) {
        const spec = ALERTS[node.tagName];
        if (!spec) return;

        const customTitle =
          typeof node.properties.title === "string"
            ? node.properties.title
            : spec.title;

        const className = new Set<string>([
          "markdown-alert",
          `markdown-alert-${node.tagName}`,
        ]);
        for (const extra of toClassList(node.properties.className)) {
          className.add(extra);
        }

        const properties: Element["properties"] = { className: [...className] };
        for (const [key, value] of Object.entries(node.properties)) {
          if (
            key === "title" ||
            key === "className" ||
            value == null ||
            !SAFE_ALERT_PROPERTIES.has(key)
          )
            continue;
          properties[key] = value;
        }

        return {
          type: "element",
          tagName: "div",
          properties,
          children: [buildTitle(spec, customTitle), ...node.children],
        } satisfies Element;
      },
    },
  });
}
