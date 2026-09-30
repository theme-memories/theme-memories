/*
 * Plyr media player enhancement.
 *
 * Markdown emits raw <audio>/<video> elements and the character page renders a
 * plain <video controls>, so both play with scripting off. Plyr is fetched here
 * in the browser, once, and only on a page that actually contains media. The
 * icons are served from this site rather than from Plyr's default CDN.
 *
 * The selector is the only thing that varies between the surfaces, so it is the
 * only thing taken as an argument.
 */

/*
 * Plyr's interface, in the site's language. Plyr ships English and carries no
 * locale files, so its own words are set here: the tooltips, the menu, the
 * fullscreen and caption labels, and the live-region text.
 *
 * `{seektime}`, `{currentTime}`, `{duration}` and `{title}` are Plyr's
 * placeholders. The quality badges stay Latin, because they are badges rather
 * than words.
 */
const I18N = {
  restart: "最初から再生",
  rewind: "{seektime}秒戻る",
  play: "再生",
  pause: "一時停止",
  fastForward: "{seektime}秒進む",
  seek: "シーク",
  seekLabel: "{currentTime} / {duration}",
  played: "再生済み",
  buffered: "読み込み済み",
  currentTime: "現在の時間",
  duration: "再生時間",
  volume: "音量",
  mute: "ミュート",
  unmute: "ミュートを解除",
  enableCaptions: "字幕を表示",
  disableCaptions: "字幕を非表示",
  download: "ダウンロード",
  enterFullscreen: "全画面にする",
  exitFullscreen: "全画面を終了する",
  frameTitle: "{title} のプレイヤー",
  captions: "字幕",
  settings: "設定",
  pip: "ピクチャインピクチャ",
  menuBack: "前のメニューに戻る",
  speed: "再生速度",
  normal: "標準",
  quality: "画質",
  loop: "ループ",
  start: "開始",
  end: "終了",
  all: "すべて",
  reset: "リセット",
  disabled: "無効",
  enabled: "有効",
  advertisement: "広告",
  qualityBadge: {
    2160: "4K",
    1440: "HD",
    1080: "HD",
    720: "HD",
    576: "SD",
    480: "SD",
  },
};

export const enhanceMediaPlayers = (selector: string) => {
  const media = document.querySelectorAll<HTMLMediaElement>(selector);
  if (media.length === 0) return;

  void import("plyr").then(({ default: Plyr }) => {
    for (const element of media) {
      new Plyr(element, { iconUrl: "/plyr.svg", i18n: I18N });
    }
  });
};
