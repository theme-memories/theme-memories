/*
 * Renders the container directives the site supports as daisyUI alerts, with a
 * Japanese label in place of GitHub's English one.
 *
 * The `:::note` spelling and the GitHub `> [!NOTE]` spelling both reach this
 * plugin as a `note` directive (the latter via `mdast-admonitions.ts`), so the
 * two are the same feature with two entry points.
 */
import { defineMdastPlugin } from "satteri";

type Alert = { variant: string; label: string };

const ALERTS: Readonly<Record<string, Alert>> = {
  note: { variant: "info", label: "注記" },
  tip: { variant: "success", label: "ヒント" },
  info: { variant: "info", label: "重要" },
  warning: { variant: "warning", label: "警告" },
  danger: { variant: "error", label: "注意" },
};

export const mdastAlertsPlugin = defineMdastPlugin({
  name: "mdast-alerts",
  containerDirective(node, context) {
    const alert = ALERTS[node.name];

    /*
     * An unknown directive still needs an element of its own, or Sätteri drops
     * a container directive with no handler and takes its content with it.
     */
    context.setProperty(node, "data", {
      hName: "div",
      hProperties: alert
        ? { class: `alert alert-${alert.variant}`, role: "alert" }
        : { class: "alert" },
    });

    if (!alert) return;

    context.prependChild(node, {
      type: "paragraph",
      data: { hName: "span", hProperties: { class: "font-bold" } },
      children: [{ type: "text", value: alert.label }],
    });
  },
});
