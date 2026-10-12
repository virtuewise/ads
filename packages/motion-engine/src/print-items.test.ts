import { describe, it, expect } from 'vitest';
import {
  PRINT_ITEMS,
  PRINT_ITEM_ACCENT,
  SCENE_UNITS_PER_MM,
  getPrintItem,
  printItemBoundingRadius,
  printItemFrontAspect,
  toSceneUnits,
} from './print-items.js';

describe('PRINT_ITEMS catalogue', () => {
  it('is populated with unique ids', () => {
    expect(PRINT_ITEMS.length).toBeGreaterThanOrEqual(12);
    const ids = PRINT_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses known categories and material presets', () => {
    const categories = ['flat', 'label', 'box', 'container', 'banner'];
    const materials = ['paperMatte', 'paperGloss', 'kraft', 'foil', 'paint', 'metal', 'plastic'];
    for (const item of PRINT_ITEMS) {
      expect(categories).toContain(item.category);
      expect(materials).toContain(item.material);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('has strictly positive dimensions on every axis', () => {
    for (const item of PRINT_ITEMS) {
      expect(item.dimensions.width).toBeGreaterThan(0);
      expect(item.dimensions.height).toBeGreaterThan(0);
      expect(item.dimensions.depth).toBeGreaterThan(0);
    }
  });

  it('keeps corner radii within half the smallest face', () => {
    for (const item of PRINT_ITEMS) {
      if (item.cornerRadius === undefined) continue;
      const limit = Math.min(item.dimensions.width, item.dimensions.height) / 2;
      expect(item.cornerRadius).toBeGreaterThan(0);
      expect(item.cornerRadius).toBeLessThanOrEqual(limit);
    }
  });

  it('matches canonical ISO / industry flat sizes exactly', () => {
    expect(getPrintItem('business-card')?.dimensions).toEqual({ width: 85, height: 55, depth: 0.4 });
    expect(getPrintItem('postcard-a6')?.dimensions).toEqual({ width: 105, height: 148, depth: 0.45 });
    expect(getPrintItem('flyer-a5')?.dimensions).toEqual({ width: 148, height: 210, depth: 0.15 });
    expect(getPrintItem('brochure-a4')?.dimensions).toEqual({ width: 148, height: 210, depth: 3 });
  });

  it('exposes every item through getPrintItem and rejects unknown ids', () => {
    for (const item of PRINT_ITEMS) {
      expect(getPrintItem(item.id)).toBe(item);
    }
    expect(getPrintItem('does-not-exist')).toBeUndefined();
  });
});

describe('revolve profiles', () => {
  const revolveItems = PRINT_ITEMS.filter((item) => item.kind === 'revolve');

  it('ships at least one revolve item', () => {
    expect(revolveItems.length).toBeGreaterThan(0);
  });

  it('is symmetric in the X/Z plane', () => {
    for (const item of revolveItems) {
      expect(item.dimensions.width).toBe(item.dimensions.depth);
    }
  });

  it('has monotonic, closed, positive profiles', () => {
    for (const item of revolveItems) {
      const profile = item.profile ?? [];
      expect(profile.length).toBeGreaterThan(2);
      expect(profile[0]?.t).toBe(0);
      expect(profile[profile.length - 1]?.t).toBe(1);
      expect(profile[0]?.r).toBe(0);
      expect(profile[profile.length - 1]?.r).toBe(0);

      for (let i = 0; i < profile.length; i++) {
        const point = profile[i]!;
        expect(point.t).toBeGreaterThanOrEqual(0);
        expect(point.t).toBeLessThanOrEqual(1);
        if (i > 0) {
          expect(point.t).toBeGreaterThanOrEqual(profile[i - 1]!.t);
        }
        const isEndpoint = i === 0 || i === profile.length - 1;
        if (!isEndpoint) {
          expect(point.r).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('unit scale & derived measures', () => {
  it('converts millimetres to scene units with a single shared scale', () => {
    expect(SCENE_UNITS_PER_MM).toBe(0.001);
    expect(toSceneUnits(1000)).toBe(1);
    expect(toSceneUnits(85)).toBeCloseTo(0.085, 12);
    expect(toSceneUnits(-10)).toBeCloseTo(-0.01, 12);
  });

  it('computes the front aspect ratio exactly', () => {
    const card = getPrintItem('business-card')!;
    expect(printItemFrontAspect(card)).toBeCloseTo(85 / 55, 12);
  });

  it('derives a positive bounding radius for every item', () => {
    for (const item of PRINT_ITEMS) {
      expect(printItemBoundingRadius(item)).toBeGreaterThan(0);
    }
    const card = getPrintItem('business-card')!;
    const expected = (Math.hypot(85, 55, 0.4) / 2) * 0.001;
    expect(printItemBoundingRadius(card)).toBeCloseTo(expected, 12);
  });

  it('shares one brand accent across the catalogue', () => {
    expect(PRINT_ITEM_ACCENT).toBe('#c8001c');
  });
});
