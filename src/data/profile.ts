/*
 * The character profile on /about.
 *
 * One source of truth, the way the categories are: the band, the table and the
 * description all derive from here, so a correction is a one-line edit rather
 * than a hunt through markup.
 */
export const profile = {
  romanised: "AKIYAMA MIZUKI",
  name: "暁山 瑞希",
  voice: "佐藤 日向",
  unit: "25時、ナイトコードで。",
  role: "動画担当",
} as const;

/*
 * The source page toggles between two points in the character's life. The height
 * and the year differ, and so does the prose she is introduced with: all of it
 * is hers at one point in time, not the character's fixed facts.
 *
 * So the era lives on the value rather than on the sheet. A string is true in
 * both eras; an object carries the one that is not. Writing the whole sheet out
 * twice would have meant keeping six identical rows in step by hand, and the
 * next difference would have had nowhere to go but a third copy.
 */
type Value = string | { past: string; now: string };

type Cell = { label: string; value: Value };

/*
 * The spec sheet is table-shaped, so it is stored as table rows rather than as
 * one flat list. A row is an array because the source page packs some rows with
 * two name/value pairs and leaves others at one, and that rhythm is the point:
 * flattening it would turn a character sheet into a form.
 *
 * The order is the source page's order, which is not the order a Western form
 * would use.
 */
export const rows: Cell[][] = [
  [{ label: "性別", value: "?" }],
  [
    { label: "誕生日", value: "8月27日" },
    { label: "身長", value: { past: "163cm", now: "165cm" } },
  ],
  [
    { label: "学校", value: "神山高校" },
    { label: "学年", value: { past: "1-A", now: "2-B" } },
  ],
  [{ label: "趣味", value: "動画素材集め、コラージュ" }],
  [{ label: "特技", value: "洋服のアレンジ" }],
  [{ label: "苦手なもの", value: "熱い食べ物" }],
];

/*
 * The two eras, in the order and with the default the source page uses: the
 * past first, the present current.
 *
 * Both descriptions are placeholders, carried over from the page this replaced.
 * The real text goes here and renders as it is written.
 *
 * The video's source is a placeholder too, and the two point at separate files
 * rather than at one: the point of the second film is that it is the other
 * film, so a single URL would make the toggle a no-op. The poster is an image
 * the page imports, so it lives there rather than here.
 */
export const eras = {
  past: {
    label: "過去",
    quote: "カワイイものなら、何でもウェルカムだよ♪",
    description: [
      "可愛いものが大好きな気分屋。たまたま聴いた奏の曲に惹かれるものを感じ、MVをつくって投稿する。それが奏自身の目に留まり、動画担当として誘われた。サークルメンバーの誰も知らない秘密がある。 ",
    ],
    video: { src: "https://object.amia.work/assets/mizuki-past.mp4" },
  },
  now: {
    label: "現在",
    quote: "ボクは、ボクのままでいいかなって、思えたんだ",
    description: [
      "『25時、ナイトコードで。』の動画担当。母親と関係が悪化していくまふゆのことを心配していたが、瑞希自身、自分の秘密と向きあえずにいる現状から無力感を覚えていた。だが、その経験から逃げることで得られるものがあることにも気づき、まふゆに「逃げていい」と助言する。 ",
    ],
    video: { src: "https://object.amia.work/assets/mizuki-new.mp4" },
  },
} as const;

export type Era = keyof typeof eras;

/*
 * The past first, and the present is what the page opens on, which is the way
 * round the source page has it.
 */
export const eraKeys = ["past", "now"] as const;
export const defaultEra: Era = "now";

/*
 * The name the film section carries, which is the same in both eras: it is the
 * section's title, not the film's. The film itself is `eras[era].video`.
 */
export const videoTitle = "キャラクタームービー";
