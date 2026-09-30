/*
 * Click burst.
 *
 * A press on the page leaves a small firework of circles and one opening ring at
 * the pointer. The tweening is anime.js — the same engine the effect this borrows
 * from used — and this module owns everything around it: the canvas, the rules
 * about what counts as a press, and when the engine is allowed to run at all.
 *
 * None of it is load-bearing. The effect is decoration the page never depends on,
 * so it is dropped entirely for a reader who has asked for less motion, and it can
 * never stop the page answering a click: the canvas takes no pointer events, and
 * every press is read from the document rather than intercepted on the way.
 *
 * The engine runs only while a burst is alive. anime.js drops its own frame loop
 * when nothing is ticking, so a page sitting still costs nothing, which is the one
 * thing the original could not say: it kept a permanent animation running from
 * load onwards purely to clear the canvas.
 */

import type { Target } from "animejs";
import {
  FIREWORK_LIMITS,
  buildBurst,
  pick,
  type Burst,
  type Particle,
  type Random,
  type Ring,
} from "../utils/fireworks";

const CANVAS_SELECTOR = ".fireworks";

/** A press on one of these is a press on the page, not on the space around it. */
const CHROME_SELECTOR =
  "a, button, input, select, textarea, label, summary, [data-no-fireworks]";

const LOADER_ID = "page-loader";

/** How far a finger may drift before the press reads as a scroll. */
const TAP_SLOP_PX = 8;

/** How long a finger may rest before the press reads as a hold. */
const TAP_MAX_MS = 700;

/*
 * Retina beyond 2× buys detail a 16px circle cannot show, and costs a buffer four
 * times the area of the viewport on a three-times screen.
 */
const MAX_DPR = 2;

/** Assigning to `canvas.width` reallocates the buffer, so a drag waits it out. */
const RESIZE_DEBOUNCE_MS = 500;

/** nord's accent, reachable only if the token cannot be read at all. */
const ACCENT_FALLBACK = "#5e81ac";

type Anime = typeof import("animejs");
type RenderLoop = ReturnType<Anime["createTimer"]>;

/*
 * anime.js types a tween's function value as receiving a `Target` — a DOM node or
 * a plain object — while everything this module animates is one of its own
 * descriptors. The read is narrowed once here rather than at every property.
 */
const particleValue =
  (read: (particle: Particle) => number) =>
  (target?: Target): number =>
    read(target as unknown as Particle);

const particleEndX = particleValue((particle) => particle.end.x);
const particleEndY = particleValue((particle) => particle.end.y);

export const enhanceFireworks = () => {
  const canvas = document.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);

  /* Marked before anything else, so a second call cannot mount a second burst. */
  if (!canvas || canvas.dataset.fireworks === "on") return;

  /*
   * Dropped, not shortened. Nothing depends on this effect, so the preference that
   * asks for less movement is answered by the burst simply never existing — the
   * same answer the loader's animation gets.
   */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.dataset.fireworks = "on";

  let width = 0;
  let height = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    /*
     * The buffer is scaled rather than the shapes, so a circle is drawn once at
     * device resolution instead of being upscaled by the browser. Display size
     * comes from the stylesheet, which is also why the original's soft output on
     * a retina screen does not carry over.
     */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();

  let resizeTimer = 0;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, RESIZE_DEBOUNCE_MS);
    },
    { passive: true },
  );

  /*
   * anime.js is fetched rather than imported, and only once the page has stopped
   * loading. This is decoration at the end of a page whose loader exists to wait
   * on the fonts and every image, so the chunk is warmed in an idle moment rather
   * than raced against them. A press before it arrives is not lost: the handler
   * awaits the same promise, and the burst is thrown once it resolves.
   */
  let anime: Promise<Anime> | null = null;
  const loadAnime = () => (anime ??= import("animejs"));

  const warm = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => void loadAnime(), { timeout: 2000 });
    } else {
      /* Safari carried `requestIdleCallback` late, so the timer is not the only
         path this can take. */
      window.setTimeout(() => void loadAnime(), 200);
    }
  };

  if (document.readyState === "complete") {
    warm();
  } else {
    window.addEventListener("load", warm, { once: true });
  }

  const bursts: Burst[] = [];

  const drawParticles = (particles: Particle[]) => {
    for (const particle of particles) {
      if (particle.radius <= 0) continue;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.fill();
    }
  };

  const drawRing = (ring: Ring) => {
    if (ring.radius <= 0 || ring.lineWidth <= 0 || ring.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = ring.alpha;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.lineWidth = ring.lineWidth;
    ctx.strokeStyle = ring.color;
    ctx.stroke();
    ctx.restore();
  };

  /*
   * Every live burst is painted from one place. The original had each burst draw
   * itself from its own tween, which worked only because an eternal clear-tween
   * happened to be registered before them and ran first; here two bursts landing
   * on top of each other cannot erase one another, whatever order they arrived in.
   */
  const paint = () => {
    ctx.clearRect(0, 0, width, height);

    for (const burst of bursts) {
      drawRing(burst.ring);
      drawParticles(burst.particles);
    }
  };

  let render: RenderLoop | null = null;

  /*
   * The ring is drawn in the page's accent rather than the original's white, which
   * is invisible on the light theme. It is read per burst rather than cached, so a
   * theme toggle is picked up by the next press without an observer.
   */
  const accent = () =>
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary")
      .trim() || ACCENT_FALLBACK;

  const burst = async (x: number, y: number) => {
    try {
      const { createTimer, createTimeline, utils } = await loadAnime();
      const random: Random = (min, max) => utils.random(min, max);

      const fresh = buildBurst({ x, y }, accent(), random);
      bursts.push(fresh);

      render ??= createTimer({ onUpdate: paint });
      render.play();

      await createTimeline()
        .add(fresh.particles, {
          x: particleEndX,
          y: particleEndY,
          radius: FIREWORK_LIMITS.particleEndRadius,
          duration: pick(FIREWORK_LIMITS.particleDuration, random),
          ease: "outExpo",
        })
        .add(
          fresh.ring,
          {
            radius: fresh.ring.endRadius,
            lineWidth: 0,
            alpha: {
              to: 0,
              ease: "linear",
              duration: pick(FIREWORK_LIMITS.ringFade, random),
            },
            duration: pick(FIREWORK_LIMITS.ringDuration, random),
            ease: "outExpo",
          },
          0,
        )
        .then();

      bursts.splice(bursts.indexOf(fresh), 1);

      /*
       * The last burst is gone, so the engine is stopped rather than left painting
       * an empty canvas a frame at a time. A quiet page costs no frames, and the
       * canvas is cleared once so nothing is left frozen on it.
       */
      if (bursts.length === 0) {
        paint();
        render.pause();
      }
    } catch {
      /*
       * Decoration, never load-bearing: a burst that cannot run — an unreachable
       * chunk, a browser without canvas — is not something the reader needs told.
       */
    }
  };

  const onChrome = (target: EventTarget | null) =>
    target instanceof Element && target.closest(CHROME_SELECTOR) !== null;

  let tap: { x: number; y: number; started: number } | null = null;

  document.addEventListener(
    "pointerdown",
    (event) => {
      /*
       * The primary button of the primary pointer. A right click, or a second
       * finger joining a pinch, is not a press on the page.
       */
      if (!event.isPrimary || event.button !== 0) return;

      /*
       * A press on a control belongs to the control. On a link the burst would be
       * spent on a page already leaving, and on anything else it would land behind
       * something the reader is about to look at.
       */
      if (onChrome(event.target)) return;

      /* The veil covers the page while it is up, so nobody would see it. */
      if (document.getElementById(LOADER_ID)) return;

      /*
       * A finger is measured before it is believed: on a phone the press is also
       * how a scroll begins, and a burst already painted cannot be taken back.
       */
      if (event.pointerType === "touch") {
        tap = {
          x: event.clientX,
          y: event.clientY,
          started: performance.now(),
        };
        return;
      }

      void burst(event.clientX, event.clientY);
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerup",
    (event) => {
      const started = tap;
      tap = null;

      if (!started || !event.isPrimary) return;
      if (onChrome(event.target)) return;
      if (
        Math.hypot(event.clientX - started.x, event.clientY - started.y) >
        TAP_SLOP_PX
      )
        return;
      if (performance.now() - started.started > TAP_MAX_MS) return;

      void burst(event.clientX, event.clientY);
    },
    { passive: true },
  );

  /*
   * A scroll takes the pointer away rather than releasing it, which is what makes
   * the drift test above the second of two answers instead of the only one.
   */
  document.addEventListener(
    "pointercancel",
    () => {
      tap = null;
    },
    { passive: true },
  );
};
