/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "import-notation": "string",
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme", "plugin", "utility"],
      },
    ],
    "at-rule-prelude-no-invalid": [true, { ignoreAtRules: ["apply"] }],
    // Expressive Code fixes the names of its theme variables, e.g. `--ec-codeBg`.
    "custom-property-pattern":
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$|^ec-[A-Za-z0-9-]+$",
    // Plyr fixes the names of its own classes, e.g. `plyr__control`.
    "selector-class-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$|^plyr(__|--)[a-z0-9_-]+$",
      {
        message: (selector) =>
          `Expected class selector "${selector}" to be kebab-case`,
      },
    ],
  },
};
