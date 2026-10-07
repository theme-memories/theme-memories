/*
 * Video.js media player registration.
 *
 * A player is authored declaratively — a `media-i18n` provider around a
 * `video-player` or `audio-player`, a skin, and the native media element — so
 * the markup is inert until the elements are defined here. The media keeps its
 * `controls` for the no-JS fallback, and they are removed once the skin owns
 * playback, because Video.js does not remove them on its own.
 *
 * The modules are fetched in the browser, once, and only on a page that
 * actually contains a player. The selector is the only thing that varies
 * between the surfaces, so it is the only thing taken as an argument.
 */
export const enhanceMediaPlayers = (selector: string) => {
  const players = [...document.querySelectorAll<HTMLElement>(selector)];
  if (players.length === 0) return;

  const tags = new Set(players.map((player) => player.localName));

  void (async () => {
    /*
     * Registered before any provider or player is defined, so the first paint
     * is already in the site's language rather than the lazy default pack
     * arriving after it. The pack is bundled, so nothing is fetched from a CDN.
     */
    await import("@videojs/html/i18n/locales/ja/register");

    const modules: Array<Promise<unknown>> = [import("@videojs/html/i18n")];
    if (tags.has("video-player")) {
      modules.push(
        import("@videojs/html/video/player"),
        import("@videojs/html/video/neutral-skin"),
      );
    }
    if (tags.has("audio-player")) {
      modules.push(
        import("@videojs/html/audio/player"),
        import("@videojs/html/audio/neutral-skin"),
      );
    }
    await Promise.all(modules);

    /*
     * The fallback controls come off now that the skin draws its own, or the
     * browser's bar would sit behind the skin's.
     */
    for (const player of players) {
      for (const media of player.querySelectorAll<HTMLMediaElement>(
        "video, audio",
      )) {
        media.removeAttribute("controls");
      }
    }
  })();
};
