import { describe, expect, it } from "vitest";
import {
  FIREWORK_COLORS,
  FIREWORK_LIMITS,
  buildBurst,
  buildParticles,
  buildRing,
  particleEnd,
  pick,
  type Random,
} from "../src/utils/fireworks";

/** A generator that always answers with the bottom of the range it is given. */
const lowest: Random = (min) => min;

/** A generator that always answers with the top of the range it is given. */
const highest: Random = (_min, max) => max;

const ORIGIN = { x: 100, y: 50 };
const ACCENT = "#5e81ac";

const fromOrigin = (point: { x: number; y: number }) =>
  Math.hypot(point.x - ORIGIN.x, point.y - ORIGIN.y);

describe("pick", () => {
  it("answers with what the generator gives inside the range", () => {
    expect(pick([2, 8], lowest)).toBe(2);
    expect(pick([2, 8], highest)).toBe(8);
  });

  it("hands the generator the range it was given", () => {
    const seen: number[] = [];

    pick([3, 7], (min, max) => {
      seen.push(min, max);
      return min;
    });

    expect(seen).toEqual([3, 7]);
  });
});

describe("particleEnd", () => {
  it("sends a particle straight out along the x axis at angle zero", () => {
    expect(particleEnd(ORIGIN, 100, 0)).toEqual({ x: 200, y: 50 });
  });

  it("reaches twice the distance at a quarter turn, where the modulation peaks", () => {
    const end = particleEnd(ORIGIN, 100, Math.PI / 2);

    expect(end.x).toBeCloseTo(ORIGIN.x);
    expect(end.y).toBeCloseTo(ORIGIN.y + 200);
  });

  it("keeps every end finite across a full turn", () => {
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const end = particleEnd(ORIGIN, 110, (degrees * Math.PI) / 180);

      expect(Number.isFinite(end.x)).toBe(true);
      expect(Number.isFinite(end.y)).toBe(true);
    }
  });
});

describe("buildParticles", () => {
  it("throws one particle per press, all of them from the origin", () => {
    const particles = buildParticles(ORIGIN, lowest);

    expect(particles).toHaveLength(FIREWORK_LIMITS.particles);
    for (const particle of particles) {
      expect(particle.x).toBe(ORIGIN.x);
      expect(particle.y).toBe(ORIGIN.y);
    }
  });

  it("keeps every radius inside the range the burst declares", () => {
    for (const random of [lowest, highest]) {
      for (const particle of buildParticles(ORIGIN, random)) {
        expect(particle.radius).toBeGreaterThanOrEqual(
          FIREWORK_LIMITS.particleRadius[0],
        );
        expect(particle.radius).toBeLessThanOrEqual(
          FIREWORK_LIMITS.particleRadius[1],
        );
      }
    }
  });

  it("draws every particle from the burst's palette", () => {
    for (const random of [lowest, highest]) {
      for (const particle of buildParticles(ORIGIN, random)) {
        expect(FIREWORK_COLORS).toContain(particle.color);
      }
    }
  });

  it("carries a particle away from where it started", () => {
    const [particle] = buildParticles(ORIGIN, lowest);

    expect(particle.end).toEqual({
      x: ORIGIN.x + FIREWORK_LIMITS.particleDistance[0],
      y: ORIGIN.y,
    });
  });

  it("stops every particle within twice the distance it was thrown", () => {
    const farthest = FIREWORK_LIMITS.particleDistance[1] * 2;

    for (const particle of buildParticles(ORIGIN, highest)) {
      expect(fromOrigin(particle.end)).toBeLessThanOrEqual(farthest);
    }
  });
});

describe("buildRing", () => {
  it("opens from a point, in the colour it is handed", () => {
    expect(buildRing(ORIGIN, ACCENT, lowest)).toMatchObject({
      x: ORIGIN.x,
      y: ORIGIN.y,
      radius: FIREWORK_LIMITS.ringStartRadius,
      lineWidth: FIREWORK_LIMITS.ringLineWidth,
      alpha: FIREWORK_LIMITS.ringAlpha,
      color: ACCENT,
    });
  });

  it("keeps its end radius inside the range the burst declares", () => {
    for (const random of [lowest, highest]) {
      const ring = buildRing(ORIGIN, ACCENT, random);

      expect(ring.endRadius).toBeGreaterThanOrEqual(
        FIREWORK_LIMITS.ringRadius[0],
      );
      expect(ring.endRadius).toBeLessThanOrEqual(FIREWORK_LIMITS.ringRadius[1]);
    }
  });

  it("ends wider than it starts", () => {
    expect(buildRing(ORIGIN, ACCENT, lowest).endRadius).toBeGreaterThan(
      FIREWORK_LIMITS.ringStartRadius,
    );
  });
});

describe("buildBurst", () => {
  it("throws the particles and the ring from the same point", () => {
    const burst = buildBurst(ORIGIN, ACCENT, lowest);

    expect(burst.particles).toHaveLength(FIREWORK_LIMITS.particles);
    expect(burst.ring).toMatchObject({
      x: ORIGIN.x,
      y: ORIGIN.y,
      color: ACCENT,
    });
  });
});
