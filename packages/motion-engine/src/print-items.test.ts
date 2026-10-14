import { describe, expect, it } from 'vitest';
import {
  getPrintItem,
  PRINT_ITEM_ACCENT,
  PRINT_ITEMS,
  printItemBevelMm,
  printItemBodyHeight,
  printItemBoundingRadius,
  printItemCapHeight,
  printItemDecalRect,
  printItemFlapThickness,
  printItemFrontAspect,
  printItemSealHeight,
  printItemWrapBand,
  revolveRadiusAt,
  SCENE_UNITS_PER_MM,
  toSceneUnits,
} from './print-items.js';

const MATERIAL_PRESETS = [
  'paperMatte',
  'paperGloss',
  'kraft',
  'foil',
  'paint',
  'metal',
  'plastic',
  'softTouch',
  'corrugated',
  'chrome',
  'board',
];

describe('PRINT_ITEMS catalogue', () => {
  it('is populated with unique ids', () => {
    expect(PRINT_ITEMS.length).toBeGreaterThanOrEqual(12);
    const ids = PRINT_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses known categories and material presets', () => {
    const categories = ['flat', 'label', 'box', 'container', 'banner'];
    const kinds = ['slab', 'disk', 'roundedBox', 'revolve', 'pouch', 'rollup', 'carton'];
    for (const item of PRINT_ITEMS) {
      expect(categories).toContain(item.category);
      expect(kinds).toContain(item.kind);
      expect(MATERIAL_PRESETS).toContain(item.material);
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

  it('models closures entirely within the overall height', () => {
    for (const item of PRINT_ITEMS) {
      if (!item.cap) continue;
      expect(item.cap.height).toBeGreaterThan(0);
      expect(item.cap.height).toBeLessThan(item.dimensions.height);
      expect(item.cap.diameter).toBeGreaterThan(0);
      expect(MATERIAL_PRESETS).toContain(item.cap.material);
    }
  });

  it('includes the new fidelity shapes', () => {
    for (const id of [
      'greeting-card-a5',
      'cereal-carton',
      'perfume-carton',
      'wine-bottle-750',
      'jam-jar-250',
      'tumbler-350',
    ]) {
      expect(getPrintItem(id)).toBeDefined();
    }
    expect(getPrintItem('cereal-carton')?.kind).toBe('carton');
    expect(getPrintItem('wine-bottle-750')?.cap?.style).toBe('screw');
    expect(getPrintItem('jam-jar-250')?.cap?.style).toBe('lid');
  });

  it('matches canonical ISO / industry flat sizes exactly', () => {
    expect(getPrintItem('business-card')?.dimensions).toEqual({
      width: 85,
      height: 55,
      depth: 0.4,
    });
    expect(getPrintItem('postcard-a6')?.dimensions).toEqual({
      width: 105,
      height: 148,
      depth: 0.45,
    });
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

  it('never exceeds the stated diameter at the widest point', () => {
    for (const item of revolveItems) {
      const maxRadius = Math.max(...(item.profile ?? []).map((p) => p.r));
      expect(maxRadius * 2).toBeLessThanOrEqual(item.dimensions.width + 1e-9);
    }
  });
});

describe('shape helpers', () => {
  it('reports body height as overall height minus the closure', () => {
    const bottle = getPrintItem('bottle-500')!;
    expect(printItemCapHeight(bottle)).toBe(0);
    expect(printItemBodyHeight(bottle)).toBe(220);

    const wine = getPrintItem('wine-bottle-750')!;
    expect(printItemCapHeight(wine)).toBe(18);
    expect(printItemBodyHeight(wine)).toBe(282);

    const jar = getPrintItem('jam-jar-250')!;
    expect(printItemCapHeight(jar)).toBe(14);
    expect(printItemBodyHeight(jar)).toBe(82);
  });

  it('reports flap thickness only for cartons', () => {
    expect(printItemFlapThickness(getPrintItem('folding-carton')!)).toBeGreaterThan(0);
    expect(printItemFlapThickness(getPrintItem('business-card')!)).toBe(0);
  });

  it('reports seal height only for pouches', () => {
    expect(printItemSealHeight(getPrintItem('coffee-pouch')!)).toBeGreaterThan(0);
    expect(printItemSealHeight(getPrintItem('rigid-box')!)).toBe(0);
  });

  it('rounds rigid boxes by their radius and papers by a fine bevel', () => {
    expect(printItemBevelMm(getPrintItem('rigid-box')!)).toBe(5);
    expect(printItemBevelMm(getPrintItem('mailer-box')!)).toBe(6);
    expect(printItemBevelMm(getPrintItem('business-card')!)).toBeCloseTo(0.4, 12);
    expect(printItemBevelMm(getPrintItem('cereal-carton')!)).toBeCloseTo(0.8, 12);
  });

  it('interpolates revolve radii linearly between profile points', () => {
    const bottle = getPrintItem('bottle-500')!;
    expect(revolveRadiusAt(bottle.profile!, 0.5)).toBeCloseTo(32.5, 12);
    expect(revolveRadiusAt(bottle.profile!, 0.65)).toBeCloseTo(31.25, 12);
    // Just below the closing point the neck rim is still the widest radius.
    expect(revolveRadiusAt(bottle.profile!, 0.99)).toBeCloseTo(16, 12);
  });

  it('places a front decal on flat, box and carton fronts', () => {
    const card = printItemDecalRect(getPrintItem('business-card')!);
    expect(card).toEqual({ width: 84.2, height: 54.2, centerY: 27.5, z: 0.2 });

    const carton = printItemDecalRect(getPrintItem('folding-carton')!);
    expect(carton?.centerY).toBeCloseTo(90, 9);
    expect(carton?.z).toBe(30);

    const rollup = printItemDecalRect(getPrintItem('rollup-850')!);
    expect(rollup?.centerY).toBeCloseTo(1045, 9);
  });

  it('returns no front decal for revolve or disk items', () => {
    expect(printItemDecalRect(getPrintItem('bottle-500')!)).toBeNull();
    expect(printItemDecalRect(getPrintItem('sticker-round-60')!)).toBeNull();
  });

  it('places a wrap band on revolved containers', () => {
    const band = printItemWrapBand(getPrintItem('bottle-500')!);
    expect(band).not.toBeNull();
    expect(band!.radius).toBeCloseTo(32.8, 9);
    expect(band!.centerY).toBeCloseTo(88, 9);
    expect(band!.thetaLength).toBeLessThanOrEqual(Math.PI * 0.55);

    expect(printItemWrapBand(getPrintItem('business-card')!)).toBeNull();
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
