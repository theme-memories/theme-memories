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
  },
};
