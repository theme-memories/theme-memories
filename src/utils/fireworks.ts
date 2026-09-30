/*
 * The click burst's shape.
 *
 * Everything here is arithmetic on plain objects: no canvas, no document, and no
 * randomness of its own. The generator is passed in so the shapes can be checked
 * exactly in the test suite rather than sampled, and so the script and the tests
 * agree on one definition of where a particle goes.
 *
 * The values are the ones the original burst was drawn with, kept rather than
 * retuned: the burst is a fixed piece of decoration, and moving its numbers
 * changes the effect rather than the code.
 */

export type Point = { x: number; y: number };

/** The generator a burst is built from, injected rather than imported. */
export type Random = (min: number, max: number) => number;

/** An inclusive `[min, max]` pair from `FIREWORK_LIMITS`. */
export type Range = readonly [number, number];

/** The trans-pride set the original burst is drawn in. */
export const FIREWORK_COLORS = ["#5BCEFA", "#F5A9B8", "#B5E7FD", "#FAD1D9"];

export const FIREWORK_LIMITS = {
  /** How many particles one press throws. */
  particles: 30,
  particleRadius: [16, 32],
  particleDistance: [90, 110],
  particleDuration: [2000, 2800],
  /** Particles shrink to a point rather than fading out as discs. */
  particleEndRadius: 0.1,
  ringRadius: [80, 160],
  ringDuration: [2000, 2800],
  ringLineWidth: 6,
  ringAlpha: 0.5,
  /** The ring opens from a point and its stroke is gone by the time it has. */
  ringStartRadius: 0.1,
  /** How long the stroke spends fading, out of the ring's whole run. */
  ringFade: [600, 800],
} as const;

/** A particle's live position and radius, which the animation drives. */
export type Particle = {
  x: number;
  y: number;
  radius: number;
  color: string;
  /** Where the animation carries it; `x` and `y` above are where it is now. */
  end: Point;
};

/** The ring's live radius, stroke and opacity, which the animation drives. */
export type Ring = {
  x: number;
  y: number;
  radius: number;
  lineWidth: number;
  alpha: number;
  color: string;
  endRadius: number;
};

export type Burst = {
  particles: Particle[];
  ring: Ring;
};

export const pick = (range: Range, random: Random): number =>
  random(range[0], range[1]);

/*
 * Where a particle comes to rest.
 *
 * The demo's own formula, kept rather than corrected: the radius is modulated by
 * `1 + sin(angle)`, so the burst reaches further on one side than the other.
 * That lopsidedness is what makes it read as a firework going off rather than as
 * a puffball, and it is the reason this is not simply a point on a circle.
 */
export const particleEnd = (
  origin: Point,
  distance: number,
  angle: number,
): Point => {
  const reach = distance * (1 + Math.sin(angle));

  return {
    x: origin.x + reach * Math.cos(angle),
    y: origin.y + reach * Math.sin(angle),
  };
};

export const buildParticles = (origin: Point, random: Random): Particle[] =>
  Array.from({ length: FIREWORK_LIMITS.particles }, () => ({
    x: origin.x,
    y: origin.y,
    radius: pick(FIREWORK_LIMITS.particleRadius, random),
    color: FIREWORK_COLORS[random(0, FIREWORK_COLORS.length - 1)],
    end: particleEnd(
      origin,
      pick(FIREWORK_LIMITS.particleDistance, random),
      (random(0, 360) * Math.PI) / 180,
    ),
  }));

export const buildRing = (
  origin: Point,
  color: string,
  random: Random,
): Ring => ({
  x: origin.x,
  y: origin.y,
  radius: FIREWORK_LIMITS.ringStartRadius,
  lineWidth: FIREWORK_LIMITS.ringLineWidth,
  alpha: FIREWORK_LIMITS.ringAlpha,
  color,
  endRadius: pick(FIREWORK_LIMITS.ringRadius, random),
});

/*
 * One press: the particles and the ring that opens behind them. The ring's colour
 * is the caller's to choose, because it is the one part of the burst drawn from
 * the page's own palette rather than from the flag.
 */
export const buildBurst = (
  origin: Point,
  ringColor: string,
  random: Random,
): Burst => ({
  particles: buildParticles(origin, random),
  ring: buildRing(origin, ringColor, random),
});
