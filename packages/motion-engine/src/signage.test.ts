import { describe, expect, it } from 'vitest';
import { toSceneUnits } from './print-items.js';
import {
  getRoadSign,
  ROAD_SIGN_IDS,
  ROAD_SIGNS,
  roadSignAspect,
  roadSignOutlinePoints,
  roadSignSceneHeight,
  roadSignSceneMountHeight,
  roadSignSceneWidth,
  SIGN_PANEL_MM,
} from './signage.js';
import { required } from './test-support.js';

describe('ROAD_SIGNS', () => {
  it('has unique ids', () => {
    expect(new Set(ROAD_SIGN_IDS).size).toBe(ROAD_SIGNS.length);
  });

  it('uses positive millimetre faces', () => {
    for (const sign of ROAD_SIGNS) {
      expect(sign.width).toBeGreaterThan(0);
      expect(sign.height).toBeGreaterThan(0);
      expect(sign.mountHeight).toBeGreaterThan(0);
    }
  });

  it('spans every sign category', () => {
    const categories = new Set(ROAD_SIGNS.map((sign) => sign.category));
    expect([...categories].sort()).toEqual(['information', 'regulation', 'safety', 'wayfinding']);
  });

  it('gives every sign a distinct field colour pair', () => {
    for (const sign of ROAD_SIGNS) {
      expect(sign.field).toMatch(/^#[0-9a-f]{6}$/i);
      expect(sign.detail).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('makes warning and give-way triangles equilateral', () => {
    for (const sign of ROAD_SIGNS) {
      if (sign.kind === 'warning' || sign.kind === 'giveWay') {
        expect(sign.height).toBeCloseTo(sign.width * (Math.sqrt(3) / 2), 0);
      }
    }
  });

  it('makes stop faces regular octagons (square bounding box)', () => {
    const stop = getRoadSign('sign-stop');
    expect(stop?.width).toBe(stop?.height);
  });

  it('keeps every sign above the ground and below a realistic ceiling', () => {
    for (const sign of ROAD_SIGNS) {
      expect(sign.mountHeight).toBeGreaterThanOrEqual(1000);
      expect(sign.mountHeight).toBeLessThanOrEqual(3000);
    }
  });
});

describe('getRoadSign', () => {
  it('finds every catalogue sign by id', () => {
    for (const id of ROAD_SIGN_IDS) {
      expect(getRoadSign(id)?.id).toBe(id);
    }
  });

  it('returns undefined for unknown ids', () => {
    expect(getRoadSign('nope')).toBeUndefined();
  });
});

describe('roadSign geometry helpers', () => {
  it('converts faces and mount heights into shared scene units', () => {
    const sign = required(getRoadSign('sign-direction'), 'sign-direction is a known sign');
    expect(roadSignSceneWidth(sign)).toBeCloseTo(toSceneUnits(1200), 12);
    expect(roadSignSceneHeight(sign)).toBeCloseTo(toSceneUnits(300), 12);
    expect(roadSignSceneMountHeight(sign)).toBeCloseTo(toSceneUnits(2400), 12);
  });

  it('reports the face aspect ratio', () => {
    expect(
      roadSignAspect(required(getRoadSign('sign-direction'), 'sign-direction is a known sign')),
    ).toBeCloseTo(4, 12);
  });

  it('defaults panel thickness to 3 mm', () => {
    expect(SIGN_PANEL_MM).toBe(3);
  });
});

describe('roadSignOutlinePoints', () => {
  it('returns a triangle for warning and give-way', () => {
    expect(roadSignOutlinePoints('warning')).toHaveLength(3);
    expect(roadSignOutlinePoints('giveWay')).toHaveLength(3);
  });

  it('points the warning triangle up and the give-way triangle down', () => {
    const warning = roadSignOutlinePoints('warning');
    const giveWay = roadSignOutlinePoints('giveWay');
    expect(Math.max(...warning.map((p) => p[1]))).toBeCloseTo(0.5, 12);
    expect(Math.min(...giveWay.map((p) => p[1]))).toBeCloseTo(-0.5, 12);
  });

  it('returns a regular octagon for stop', () => {
    const points = roadSignOutlinePoints('stop');
    expect(points).toHaveLength(8);
    for (const [x, y] of points) {
      expect(Math.hypot(x, y)).toBeCloseTo(0.5 / Math.cos(Math.PI / 8), 12);
    }
  });

  it('returns a unit rectangle for every rectangular sign', () => {
    for (const kind of [
      'regulation',
      'prohibition',
      'direction',
      'chevron',
      'information',
    ] as const) {
      const points = roadSignOutlinePoints(kind);
      expect(points).toHaveLength(4);
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      expect(Math.min(...xs)).toBeCloseTo(-0.5, 12);
      expect(Math.max(...xs)).toBeCloseTo(0.5, 12);
      expect(Math.min(...ys)).toBeCloseTo(-0.5, 12);
      expect(Math.max(...ys)).toBeCloseTo(0.5, 12);
    }
  });

  it('stays inside the normalised face box for every sign', () => {
    for (const sign of ROAD_SIGNS) {
      for (const [x, y] of roadSignOutlinePoints(sign.kind)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });

  it('is deterministic', () => {
    for (const sign of ROAD_SIGNS) {
      expect(roadSignOutlinePoints(sign.kind)).toEqual(roadSignOutlinePoints(sign.kind));
    }
  });
});
