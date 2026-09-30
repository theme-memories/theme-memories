import type { AnimationItem } from "lottie-web";
import { LOADING_ANIMATION_URL } from "../consts";

/*
 * The loader's behaviour.
 *
 * The veil is CSS. It sits in the document hidden, and the head script opts it
 * in before the first paint. This module drives only what CSS cannot: the
 * progress readout, and the animation that enhances it.
 *
 * The readout is held back by what has actually happened and carried forward by
 * time, so it can never claim the page is ready before it is. The minimum only
 * sets a floor; a slow page keeps the veil up until it is genuinely done.
 */

/** Floor for how long the veil stays up, however fast the page is. */
const MIN_VISIBLE = 1200;

/*
 * Ceiling for how long it may stay up. The veil lifts on the `load` event, which
 * waits on every image, and an image that never answers would otherwise hold it
 * up for good — over content that stays unreachable, since the veil takes the
 * pointer and, with it, the keyboard.
 */
const MAX_VISIBLE = 10_000;

/** How far the readout may climb before each real milestone lands. */
const PARSED = 55;
const FONTS = 78;
const LOADED = 100;

/** Fraction of the remaining distance the readout closes each frame. */
const EASE = 0.14;

type LottieAnimation = AnimationItem;

/*
 * The animation is an enhancement on top of the progress line, never the loader
 * itself, so every failure here is silent: the veil simply reads as it did
 * before. The player is fetched only once the animation data has arrived, so an
 * unreachable asset never costs the reader a runtime download.
 */
const play = async (
  stage: HTMLElement,
): Promise<LottieAnimation | undefined> => {
  try {
    const response = await fetch(LOADING_ANIMATION_URL, { mode: "cors" });
    if (!response.ok) return undefined;
    const animationData: unknown = await response.json();

    const { default: lottie } =
      await import("lottie-web/build/player/esm/lottie_light.min.js");

    const animation = lottie.loadAnimation({
      container: stage,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });

    /* Revealed only once there is something to see, so a failure leaves no gap. */
    stage.hidden = false;
    return animation;
  } catch {
    return undefined;
  }
};

export const enhancePageLoader = () => {
  const loader = document.getElementById("page-loader");
  const fill = document.getElementById("page-loader-fill");
  const readout = document.getElementById("page-loader-pct");
  const stage = document.getElementById("page-loader-anim");

  if (!loader || !fill || !readout) return;

  /*
   * Guard rather than feature: the head script always sets the attribute, but if
   * it ever failed to, the veil must not be left sitting over the page.
   */
  if (document.documentElement.dataset.loader !== "on") {
    loader.remove();
    return;
  }

  /*
   * The veil already stops the pointer, so it has to stop the keyboard too.
   * Without this, Tab walks straight into the content the veil is covering and
   * the reader arrives somewhere they cannot see. The attribute is lifted with
   * the veil rather than at the end of the fade, so the page is interactive
   * from the moment it starts to appear.
   */
  const page = document.querySelector<HTMLElement>(".drawer-content");
  page?.setAttribute("inert", "");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const started = performance.now();

  let ceiling = 30;
  const mark = (value: number) => {
    ceiling = Math.max(ceiling, value);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mark(PARSED));
  } else {
    mark(PARSED);
  }
  /* The webfonts are the loader's own reason to exist, so it waits for them. */
  void document.fonts?.ready.then(() => mark(FONTS));
  if (document.readyState === "complete") {
    mark(LOADED);
  } else {
    window.addEventListener("load", () => mark(LOADED), { once: true });
  }

  /*
   * The animation is decoration on top of the progress line, never the loader
   * itself, so the preference that asks for less movement costs the reader the
   * loop and nothing else. The line, the readout and the milestones all still
   * run, and they are the part that says the page is genuinely arriving rather
   * than merely late.
   */
  let animation: LottieAnimation | undefined;
  if (stage && !reduced) {
    void play(stage).then((result) => {
      animation = result;
    });
  }

  let shown = 0;
  let lastWhole = -1;
  let settled = false;

  const lift = () => {
    if (settled) return;
    settled = true;
    page?.removeAttribute("inert");
    loader.classList.add("is-done");
    /* Nothing will see the animation again, so stop it before it is orphaned. */
    animation?.destroy();

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      loader.remove();
    };
    loader.addEventListener("transitionend", (event) => {
      if (event.target === loader) remove();
    });
    /* If the fade never fires, in a backgrounded tab for instance. */
    window.setTimeout(remove, 800);
  };

  const tick = () => {
    const elapsed = performance.now() - started;
    const byTime = Math.min(100, (elapsed / MIN_VISIBLE) * 100);
    const target = Math.min(byTime, ceiling);
    shown = reduced ? target : shown + (target - shown) * EASE;
    if (target - shown < 0.5) shown = target;

    fill.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;

    const whole = Math.round(shown);
    if (whole !== lastWhole) {
      lastWhole = whole;
      readout.textContent = `${whole}%`;
    }

    if (elapsed >= MIN_VISIBLE && ceiling >= LOADED && shown >= 99.9) {
      lift();
      return;
    }
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);

  /*
   * The loop above is the ordinary path, and it is driven a frame at a time. The
   * timer is the backstop for it: a timer is the one thing that still runs when
   * frames have stopped arriving, which is the state a hung image leaves a page
   * in.
   */
  window.setTimeout(lift, MAX_VISIBLE);
};
