import { describe, it, expect } from 'vitest';
import {
  CAMERA_PATHS,
  clamp01,
  resolveCameraPlan,
  type CameraPath,
} from './camera.js';

const RADIUS = 3.1;

describe('CAMERA_PATHS', () => {
  it('matches the render-input contract vocabulary', () => {
    expect([...CAMERA_PATHS]).toEqual(['turntable', 'orbit', 'dolly', 'hero', 'none']);
  });

  it('has no duplicates', () => {
    expect(new Set(CAMERA_PATHS).size).toBe(CAMERA_PATHS.length);
  });
});

describe('clamp01', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('resolveCameraPlan', () => {
  it('supports every declared camera path', () => {
    for (const path of CAMERA_PATHS) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const plan = resolveCameraPlan(path, progress, RADIUS);
        expect(plan.pose.position).toHaveLength(3);
        expect(plan.pose.lookAt).toHaveLength(3);
        expect(plan.pose.position.every(Number.isFinite)).toBe(true);
        expect(plan.worldSpin).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('clamps progress outside [0, 1]', () => {
    const before = resolveCameraPlan('turntable', -5, RADIUS);
    const after = resolveCameraPlan('turntable', 42, RADIUS);
    expect(before.pose.position).toEqual(resolveCameraPlan('turntable', 0, RADIUS).pose.position);
    expect(after.pose.position).toEqual(resolveCameraPlan('turntable', 1, RADIUS).pose.position);
  });

  it('keeps the camera outside the catalogue ring', () => {
    for (const path of CAMERA_PATHS) {
      for (const progress of [0, 0.3, 0.6, 1]) {
        const { pose } = resolveCameraPlan(path, progress, RADIUS);
        const horizontal = Math.hypot(pose.position[0], pose.position[2]);
        expect(horizontal).toBeGreaterThan(RADIUS);
      }
    }
  });

  it('keeps the camera above the floor', () => {
    for (const path of CAMERA_PATHS) {
      const { pose } = resolveCameraPlan(path, 0.5, RADIUS);
      expect(pose.position[1]).toBeGreaterThan(0);
    }
  });

  it('orbits a full revolution for the turntable path', () => {
    const start = resolveCameraPlan('turntable', 0, RADIUS).pose.position;
    const mid = resolveCameraPlan('turntable', 0.5, RADIUS).pose.position;
    const end = resolveCameraPlan('turntable', 1, RADIUS).pose.position;
    expect(mid[0]).toBeCloseTo(-start[0], 12);
    expect(mid[2]).toBeCloseTo(-start[2], 12);
    expect(end[0]).toBeCloseTo(start[0], 12);
    expect(end[2]).toBeCloseTo(start[2], 12);
  });

  it('holds a fixed vantage for the hero path while still drifting slightly', () => {
    const start = resolveCameraPlan('hero', 0, RADIUS).pose.position;
    const end = resolveCameraPlan('hero', 1, RADIUS).pose.position;
    expect(start[0]).toBeCloseTo(end[0], 12);
    expect(start[2]).toBeCloseTo(end[2], 12);
  });

  it('dollies inward as the film progresses', () => {
    const distanceAt = (p: number) => {
      const { pose } = resolveCameraPlan('dolly', p, RADIUS);
      return Math.hypot(pose.position[0], pose.position[2]);
    };
    expect(distanceAt(0)).toBeGreaterThan(distanceAt(0.5));
    expect(distanceAt(0.5)).toBeGreaterThan(distanceAt(1));
  });

  it('drops the world turntable spin whenever the camera already orbits', () => {
    const spins: Record<CameraPath, number> = {
      turntable: 1,
      orbit: 0.35,
      dolly: 0.85,
      hero: 0.15,
      none: 0,
    };
    for (const [path, expected] of Object.entries(spins) as [
      CameraPath,
      number,
    ][]) {
      expect(resolveCameraPlan(path, 0.5, RADIUS).worldSpin).toBe(expected);
    }
  });

  it('scales the framing with the layout radius', () => {
    const small = resolveCameraPlan('hero', 0, 1).pose.position;
    const large = resolveCameraPlan('hero', 0, 10).pose.position;
    expect(Math.hypot(large[0], large[2])).toBeGreaterThan(Math.hypot(small[0], small[2]));
  });
});
