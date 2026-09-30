import { defineHastPlugin } from "satteri";

/*
 * A task-list checkbox has to carry a name.
 *
 * GFM renders `- [x] Completed task` as a disabled `input[type=checkbox]` beside
 * the item's own text, and nothing ties the two together: the control reaches
 * the accessibility tree unnamed, so a screen reader reads its state with no
 * subject. The item's text is the subject, so it is written onto the input as
 * its name. `aria-hidden` would have silenced the control instead, taking the
 * checked state with it, which is the half worth keeping.
 *
 * The input is disabled, so it is never focused or operated; only the
 * announcement changes.
 */
export const hastTaskListLabels = defineHastPlugin({
  name: "hast-task-list-labels",
  element: {
    filter: ["input"],
    visit(node, ctx) {
      if (node.properties.type !== "checkbox") return;

      let parent = ctx.parent(node);
      while (parent !== undefined && parent.type === "element") {
        if (parent.tagName === "li") {
          const label = ctx.textContent(parent).trim();
          if (label !== "") ctx.setProperty(node, "aria-label", label);
          return;
        }
        parent = ctx.parent(parent);
      }
    },
  },
});
