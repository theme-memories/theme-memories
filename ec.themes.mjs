/*
 * Expressive Code themes that mirror the daisyUI palettes in
 * `src/styles/global.css`.
 *
 * These replace the bundled Kanagawa pair (`kanagawa-lotus` / `kanagawa-wave`),
 * which was authored around ukiyo-e cream and indigo and never agreed with the
 * page's blue-grey. A code block is part of the page, so its syntax palette is
 * drawn from the same pigments the page is: 藍 (`ai`/`kon`) and 朱
 * (`kinari`/`sumi`). Each theme's name is its daisyUI theme name, which is what
 * `ec.config.mjs` selects on.
 *
 * `editor.background` is the theme's `base-200` as a literal, not a CSS
 * variable: Expressive Code measures every token against it to guarantee its
 * `minSyntaxHighlightingColorContrast` floor (5.5:1), and it cannot measure
 * against a variable. The rendered surface still comes from
 * `styleOverrides.codeBackground` (`var(--color-base-200)`), so the literal here
 * and the token the page paints must stay the same colour. Inline code sits on
 * the same `--color-base-200` token (see `prose.css`), which is what keeps the
 * two forms reading as one.
 *
 * `editorLineNumber.foreground` is only a fallback: `prose.css` re-points the
 * gutter at the page's muted ink tier. Comments are deliberately upright —
 * Japanese has no italic, and the brief refuses synthesized obliques.
 */

const tokenColorsFor = (s) => [
  {
    scope: [
      "variable",
      "variable.other",
      "variable.parameter",
      "meta.definition.variable",
      "identifier",
    ],
    settings: { foreground: s.variable },
  },
  {
    scope: [
      "punctuation",
      "meta.brace",
      "punctuation.separator",
      "punctuation.terminator",
    ],
    settings: { foreground: s.punctuation },
  },
  {
    scope: [
      "keyword.operator",
      "punctuation.operator",
      "keyword.operator.new",
      "keyword.operator.expression",
    ],
    settings: { foreground: s.operator },
  },
  {
    scope: ["comment", "punctuation.definition.comment"],
    settings: { foreground: s.comment },
  },
  {
    scope: [
      "string",
      "punctuation.definition.string",
      "string.quoted",
      "string.template",
    ],
    settings: { foreground: s.string },
  },
  {
    scope: ["constant.numeric", "constant.language", "constant.character"],
    settings: { foreground: s.number },
  },
  {
    scope: [
      "constant",
      "support.constant",
      "variable.other.constant",
      "entity.name.constant",
    ],
    settings: { foreground: s.constant },
  },
  {
    scope: [
      "entity.name.function",
      "support.function",
      "variable.function",
      "meta.function-call",
    ],
    settings: { foreground: s.function },
  },
  {
    scope: [
      "entity.name.type",
      "entity.name.class",
      "entity.name.namespace",
      "support.type",
      "support.class",
      "entity.name.tag.css",
    ],
    settings: { foreground: s.type },
  },
  {
    scope: ["entity.name.tag", "meta.tag", "punctuation.definition.tag"],
    settings: { foreground: s.tag },
  },
  {
    scope: ["entity.other.attribute-name", "support.type.property-name"],
    settings: { foreground: s.attr },
  },
  {
    scope: [
      "keyword",
      "storage.type",
      "storage.modifier",
      "keyword.control",
      "keyword.other",
    ],
    settings: { foreground: s.keyword },
  },
];

/*
 * The 16 terminal colors Expressive Code reads for the `ansi` language, in the
 * order the ANSI palette uses: eight normal, then eight bright. A theme that
 * omits them falls back to Expressive Code's own defaults, which belong to no
 * theme here; drawn from the same pigments as the syntax colors, a terminal
 * transcript belongs to the page it is printed in.
 */
const ANSI_KEYS = [
  "Black",
  "Red",
  "Green",
  "Yellow",
  "Blue",
  "Magenta",
  "Cyan",
  "White",
];

const ansiColors = (palette) =>
  Object.fromEntries(
    ANSI_KEYS.flatMap((key, index) => [
      [`terminal.ansi${key}`, palette[index]],
      [`terminal.ansiBright${key}`, palette[index + 8]],
    ]),
  );

const themeFor = (name, type, c, ansi) => ({
  name,
  type,
  colors: {
    "editor.background": c.bg,
    "editor.foreground": c.fg,
    "editorGutter.background": c.bg,
    "editorLineNumber.foreground": c.gutter,
    "editorLineNumber.activeForeground": c.fg,
    "editor.lineHighlightBackground": c.highlight,
    "editor.selectionBackground": c.selection,
    "editor.selectionHighlightBackground": c.selection,
    ...ansiColors(ansi),
  },
  tokenColors: tokenColorsFor(c.syntax),
});

const ai = themeFor(
  "ai",
  "light",
  {
    bg: "#e9eef2",
    fg: "#1f2731",
    gutter: "#7a8088",
    highlight: "#dfe4e9",
    selection: "#366ba54d",
    syntax: {
      comment: "#525d6d",
      keyword: "#3d4c9f",
      string: "#1d6a4b",
      number: "#874282",
      function: "#006192",
      variable: "#343e4c",
      type: "#614989",
      constant: "#90466c",
      operator: "#47515e",
      punctuation: "#4d5662",
      tag: "#a33534",
      attr: "#5e5f19",
    },
  },
  [
    "#2b3440",
    "#a33534",
    "#1d6a4b",
    "#7a6a1a",
    "#3d4c9f",
    "#874282",
    "#1a7fae",
    "#c9d0d8",
    "#525d6d",
    "#c1463f",
    "#26855b",
    "#94762a",
    "#5566c4",
    "#a3579e",
    "#1f97c4",
    "#f4f6f8",
  ],
);

const kon = themeFor(
  "kon",
  "dark",
  {
    bg: "#1d242e",
    fg: "#e3e8ee",
    gutter: "#8a9098",
    highlight: "#272e38",
    selection: "#7cb1e84d",
    syntax: {
      comment: "#8e9cb1",
      keyword: "#9fb3fe",
      string: "#84cda9",
      number: "#e8a2e1",
      function: "#81bfeb",
      variable: "#ccd5e2",
      type: "#c6b1f0",
      constant: "#f0a8ca",
      operator: "#b2bbc8",
      punctuation: "#aab2bd",
      tag: "#fa938c",
      attr: "#bec07b",
    },
  },
  [
    "#2b3440",
    "#e06c75",
    "#84cda9",
    "#d9b46b",
    "#9fb3fe",
    "#e8a2e1",
    "#6fc2d4",
    "#ccd5e2",
    "#8e9cb1",
    "#fa938c",
    "#9fe0bd",
    "#eac97f",
    "#b7c6ff",
    "#f2bdee",
    "#8fd6e6",
    "#f2f5f9",
  ],
);

const kinari = themeFor(
  "kinari",
  "light",
  {
    bg: "#eee9e0",
    fg: "#28201a",
    gutter: "#817b73",
    highlight: "#e4dfd6",
    selection: "#b746334d",
    syntax: {
      comment: "#66584a",
      keyword: "#9d2e1c",
      string: "#3f6337",
      number: "#445695",
      function: "#804d21",
      variable: "#45372e",
      type: "#36548c",
      constant: "#924666",
      operator: "#5b4d42",
      punctuation: "#5f5349",
      tag: "#9e3047",
      attr: "#765412",
    },
  },
  [
    "#2b201a",
    "#9d2e1c",
    "#3f6337",
    "#7a5a12",
    "#36548c",
    "#924666",
    "#2d6b7a",
    "#d8d0c4",
    "#66584a",
    "#b93a24",
    "#4c7a42",
    "#94701c",
    "#46679f",
    "#ad5878",
    "#3a8396",
    "#f8f4ec",
  ],
);

const sumi = themeFor(
  "sumi",
  "dark",
  {
    bg: "#251f1b",
    fg: "#e8e4dc",
    gutter: "#908b85",
    highlight: "#2f2925",
    selection: "#ea79604d",
    syntax: {
      comment: "#a79989",
      keyword: "#fe9378",
      string: "#9ec894",
      number: "#9eb5f8",
      function: "#e1b080",
      variable: "#dad4c7",
      type: "#a0baf2",
      constant: "#f3a7c4",
      operator: "#c3b9ad",
      punctuation: "#b9afa5",
      tag: "#fb909e",
      attr: "#dbb879",
    },
  },
  [
    "#322a24",
    "#fb909e",
    "#9ec894",
    "#dbb879",
    "#a0baf2",
    "#f3a7c4",
    "#7fc7c9",
    "#dad4c7",
    "#a79989",
    "#ffb3bd",
    "#b6d9ad",
    "#edcf95",
    "#bccffa",
    "#f9c3d6",
    "#9edbdc",
    "#f6f2ea",
  ],
);

export const ecThemes = [ai, kon, kinari, sumi];
